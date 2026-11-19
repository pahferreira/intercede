import type { Clarification, Suggestion } from "@intercede/api";
import {
	useNavigate,
	useRouteContext,
	useSearch,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { track } from "../analytics";
import { isChatOpen } from "../chat";
import { readSearchEvents } from "../search-stream";
import { useCommit } from "./useCommit";

export type Exchange = {
	entry: string;
	clarification?: { question: string; answer?: string };
	status: "searching" | "answering" | "done" | "failed";
	note: string;
	suggestions: Suggestion[];
};

export function useChat() {
	const navigate = useNavigate();
	const { client } = useRouteContext({ from: "__root__" });
	const chatOpen = useSearch({ strict: false, select: isChatOpen });
	const [exchange, setExchange] = useState<Exchange | null>(null);
	const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
	const searching = useRef<AbortController | null>(null);

	const deselect = (intentionIds: string[]) => {
		setSelected((current) => {
			const next = new Set(current);
			for (const intentionId of intentionIds) next.delete(intentionId);
			return next;
		});
	};

	const commit = useCommit({ selected, onUnavailable: deselect });

	useEffect(() => {
		if (chatOpen) {
			if (!searching.current) {
				navigate({ to: "/pray", replace: true });
			}
			return;
		}
		searching.current?.abort();
		searching.current = null;
		setExchange(null);
		setSelected(new Set());
	}, [chatOpen, navigate]);

	useEffect(
		() => () => {
			return searching.current?.abort();
		},
		[],
	);

	const update = (change: (current: Exchange) => Exchange) => {
		setExchange((current) => (current ? change(current) : current));
	};

	const stream = async (
		entry: string,
		clarification: Clarification | undefined,
		signal: AbortSignal,
	) => {
		const response = await client.api.search.$post(
			{ json: { entry, clarification } },
			{ init: { signal } },
		);
		if (!response.ok || !response.body) {
			throw new Error(`unexpected status ${response.status}`);
		}
		for await (const event of readSearchEvents(response.body)) {
			if (signal.aborted) return;
			if (event.type === "note_delta") {
				update((current) => ({
					...current,
					status: "answering",
					note: current.note + event.data.text,
				}));
			} else if (event.type === "suggestions") {
				const count = event.data.suggestions.length;
				if (count > 0) {
					track("suggestions_shown", { count, fallback: false });
				}
				update((current) => ({
					...current,
					suggestions: event.data.suggestions,
				}));
			} else if (event.type === "question") {
				track("clarifying_question_shown", {});
				update((current) => ({
					...current,
					status: "answering",
					clarification: { question: event.data.question },
				}));
			} else if (event.type === "done") {
				update((current) => ({ ...current, status: "done" }));
			} else if (event.type === "error") {
				update((current) => ({ ...current, status: "failed" }));
			}
		}
	};

	const run = (entry: string, clarification?: Clarification) => {
		const controller = new AbortController();
		searching.current?.abort();
		searching.current = controller;
		stream(entry, clarification, controller.signal).catch(() => {
			if (controller.signal.aborted) return;
			update((current) => ({ ...current, status: "failed" }));
		});
	};

	const send = (entry: string) => {
		track("entry_sent", {});
		setSelected(new Set());
		commit.reset();
		setExchange({ entry, status: "searching", note: "", suggestions: [] });
		navigate({ to: "/pray", search: { chat: true } });
		run(entry);
	};

	const unansweredQuestion =
		exchange?.clarification?.answer === undefined
			? exchange?.clarification?.question
			: undefined;

	const answer = (text: string) => {
		if (!exchange || unansweredQuestion === undefined) return;
		const clarification = { question: unansweredQuestion, answer: text.trim() };
		setExchange({ ...exchange, clarification, status: "searching" });
		run(exchange.entry, clarification);
	};

	const toggle = (intentionId: string, checked: boolean) => {
		setSelected((current) => {
			const next = new Set(current);
			if (checked) {
				next.add(intentionId);
			} else {
				next.delete(intentionId);
			}
			return next;
		});
	};

	return {
		exchange: chatOpen ? exchange : null,
		selected,
		awaitingAnswer: unansweredQuestion !== undefined,
		send,
		answer,
		toggle,
		commit,
	};
}
