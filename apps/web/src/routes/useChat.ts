import type {
	SignedClarification,
	SignedTranscript,
	Suggestion,
	SuggestionMatch,
	TranscriptTurn,
} from "@intercede/api";
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
	clarification?: Omit<SignedClarification, "answer"> & { answer?: string };
	status: "searching" | "answering" | "done" | "failed" | "limited";
	note: string;
	suggestions: Suggestion[];
	match: SuggestionMatch;
	signature?: string;
};

export type Composer = "answer" | "refine" | "limited" | "finished";

type Continuation = {
	clarification?: SignedClarification;
	transcript?: SignedTranscript;
};

const opening = (entry: string): Exchange => {
	return {
		entry,
		status: "searching",
		note: "",
		suggestions: [],
		match: "close",
	};
};

const turnOf = ({
	entry,
	clarification,
	note,
	suggestions,
}: Exchange): TranscriptTurn => {
	return {
		entry,
		...(clarification?.answer !== undefined && {
			clarification: {
				question: clarification.question,
				answer: clarification.answer,
			},
		}),
		note,
		suggestions,
	};
};

type ChatOptions = {
	turnstileToken: () => Promise<string>;
};

export function useChat(options: ChatOptions) {
	const navigate = useNavigate();
	const { client } = useRouteContext({ from: "__root__" });
	const chatOpen = useSearch({ strict: false, select: isChatOpen });
	const [exchanges, setExchanges] = useState<Exchange[]>([]);
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
		setExchanges([]);
		setSelected(new Set());
	}, [chatOpen, navigate]);

	useEffect(
		() => () => {
			return searching.current?.abort();
		},
		[],
	);

	const update = (change: (current: Exchange) => Exchange) => {
		setExchanges((current) =>
			current.map((exchange, index) =>
				index === current.length - 1 ? change(exchange) : exchange,
			),
		);
	};

	const stream = async (
		entry: string,
		{ clarification, transcript }: Continuation,
		signal: AbortSignal,
	) => {
		const turnstileToken =
			clarification || transcript ? undefined : await options.turnstileToken();
		if (signal.aborted) return;
		const response = await client.api.search.$post(
			{ json: { entry, turnstileToken, clarification, transcript } },
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
				const { match, suggestions, signature } = event.data;
				if (suggestions.length > 0) {
					track("suggestions_shown", {
						count: suggestions.length,
						fallback: match === "fallback",
					});
				}
				update((current) => ({ ...current, match, suggestions, signature }));
			} else if (event.type === "question") {
				track("clarifying_question_shown", {});
				update((current) => ({
					...current,
					status: "answering",
					clarification: event.data,
				}));
			} else if (event.type === "done") {
				update((current) => ({ ...current, status: "done" }));
			} else if (event.type === "error") {
				const status =
					event.data.reason === "limit_reached" ? "limited" : "failed";
				update((current) => ({ ...current, status }));
			}
		}
	};

	const run = (entry: string, continuation: Continuation = {}) => {
		const controller = new AbortController();
		searching.current?.abort();
		searching.current = controller;
		stream(entry, continuation, controller.signal).catch(() => {
			if (controller.signal.aborted) return;
			update((current) => ({ ...current, status: "failed" }));
		});
	};

	const send = (entry: string) => {
		track("entry_sent", {});
		setSelected(new Set());
		commit.reset();
		setExchanges([opening(entry)]);
		navigate({ to: "/pray", search: { chat: true } });
		run(entry);
	};

	const last = exchanges.at(-1);

	const unansweredQuestion =
		last?.clarification?.answer === undefined ? last?.clarification : undefined;

	const answer = (text: string) => {
		if (!last || unansweredQuestion === undefined) return;
		const clarification = { ...unansweredQuestion, answer: text.trim() };
		update((current) => ({ ...current, clarification, status: "searching" }));
		run(last.entry, { clarification });
	};

	const refine = (text: string) => {
		if (last?.signature === undefined) return;
		const refinement = text.trim();
		track("refinement_sent", { n: exchanges.length });
		const transcript = {
			turns: exchanges.map(turnOf),
			signature: last.signature,
		};
		setExchanges([...exchanges, opening(refinement)]);
		run(refinement, { transcript });
	};

	const composerFor = (
		exchange: Exchange | undefined,
	): Composer | undefined => {
		if (unansweredQuestion !== undefined) return "answer";
		if (exchange?.status === "limited") return "limited";
		if (exchange?.status !== "done") return undefined;
		return exchange.signature === undefined ? "finished" : "refine";
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
		exchanges: chatOpen ? exchanges : [],
		selected,
		composer: composerFor(last),
		send,
		answer,
		refine,
		newSearch: () => navigate({ to: "/pray" }),
		toggle,
		commit,
	};
}
