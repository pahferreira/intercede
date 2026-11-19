import { afterEach, beforeEach, expect, test } from "bun:test";
import type { SearchEvent, Suggestion } from "@intercede/api";
import { fireEvent, screen } from "@testing-library/react";
import {
	controlledSearch,
	renderAt,
	type Search,
	searchesOf,
	searchOf,
} from "../../test/render";
import { initAnalytics } from "../analytics";

let events: { event: string; properties: unknown }[] = [];
const posthog = {
	init: () => {},
	capture: (event: string, properties: unknown) => {
		events.push({ event, properties });
	},
};

beforeEach(() => {
	events = [];
	initAnalytics("phc_test", posthog);
});

afterEach(() => {
	initAnalytics(undefined, posthog);
});

const entry = "People who lost their jobs";

function suggestion(n: number): Suggestion {
	return {
		intentionId: `intention-${n}`,
		text: `Intention number ${n}`,
		whyNote: `Fits for reason ${n}`,
	};
}

function answered(suggestions: Suggestion[]): SearchEvent[] {
	return [
		{ type: "status", data: { status: "searching" } },
		{ type: "note_delta", data: { text: "Here are some " } },
		{ type: "note_delta", data: { text: "people to pray for." } },
		{ type: "suggestions", data: { suggestions } },
		{ type: "done", data: {} },
	];
}

const labels = {
	en: {
		entry: "What's in your heart to pray for today?",
		start: "Start",
		newSearch: "New search",
		commit: "Commit to pray for this intention",
		answer: "Tell me more…",
		send: "Send",
	},
	"pt-BR": {
		entry: "O que está no seu coração para rezar hoje?",
		start: "Começar",
		newSearch: "Nova busca",
		commit: "Comprometer-me a rezar por esta intenção",
		answer: "Conte-me mais…",
		send: "Enviar",
	},
} as const;

async function sendEntry(
	locale: keyof typeof labels,
	search: Search,
	text = entry,
) {
	const rendered = await renderAt("/pray", locale, undefined, search);
	fireEvent.change(
		await screen.findByRole("textbox", { name: labels[locale].entry }),
		{ target: { value: text } },
	);
	fireEvent.click(screen.getByRole("button", { name: labels[locale].start }));
	return rendered;
}

test.each(["en", "pt-BR"] as const)(
	"in %s, an Entry opens the chat with the streamed note and its Suggestions",
	async (locale) => {
		await sendEntry(locale, searchOf(answered([suggestion(1), suggestion(2)])));

		expect(
			await screen.findByText("Here are some people to pray for."),
		).toBeDefined();
		expect(screen.getByText(entry)).toBeDefined();
		expect(screen.getByText("Intention number 1")).toBeDefined();
		expect(screen.getByText("Fits for reason 2")).toBeDefined();
		expect(
			screen.getAllByRole("checkbox", { name: labels[locale].commit }),
		).toHaveLength(2);
		expect(
			screen.getByRole("link", { name: labels[locale].newSearch }),
		).toBeDefined();
		expect(
			screen.queryByRole("textbox", { name: labels[locale].entry }),
		).toBeNull();
	},
);

test("the searching status shows until the note starts streaming", async () => {
	const stream = controlledSearch();
	await sendEntry("en", stream.search, `  ${entry}  `);

	expect((await screen.findByRole("status")).textContent).toBe(
		"Looking for intentions…",
	);
	expect(stream.entries).toEqual([entry]);

	stream.send(
		{ type: "status", data: { status: "searching" } },
		{ type: "note_delta", data: { text: "Praying with you." } },
	);

	expect(await screen.findByText("Praying with you.")).toBeDefined();
	expect(screen.queryByRole("status")).toBeNull();
	stream.end();
});

test("sending an Entry and showing its Suggestions are counted", async () => {
	await sendEntry("en", searchOf(answered([1, 2, 3].map(suggestion))));
	await screen.findByText("Intention number 3");

	expect(events).toEqual([
		{ event: "entry_sent", properties: {} },
		{ event: "suggestions_shown", properties: { count: 3, fallback: false } },
	]);
});

test("an answer with no Suggestions is not counted as shown", async () => {
	await sendEntry("en", searchOf(answered([])));
	await screen.findByText("Here are some people to pray for.");

	expect(events).toEqual([{ event: "entry_sent", properties: {} }]);
});

test("checking a Suggestion selects it, and unchecking clears it", async () => {
	await sendEntry("en", searchOf(answered([suggestion(1), suggestion(2)])));
	await screen.findByText("Intention number 1");
	const checkboxes = screen.getAllByRole<HTMLInputElement>("checkbox", {
		name: labels.en.commit,
	});
	const checked = () => checkboxes.map((checkbox) => checkbox.checked);
	const [first] = checkboxes as [HTMLInputElement];

	fireEvent.click(first);
	expect(checked()).toEqual([true, false]);

	fireEvent.click(first);
	expect(checked()).toEqual([false, false]);
});

test("the back button leaves the chat for an empty Entry screen", async () => {
	const { history } = await sendEntry(
		"en",
		searchOf(answered([suggestion(1)])),
	);
	await screen.findByText("Intention number 1");

	history.back();

	const textbox = await screen.findByRole<HTMLTextAreaElement>("textbox", {
		name: labels.en.entry,
	});
	expect(textbox.value).toBe("");
	expect(screen.queryByText("Intention number 1")).toBeNull();
	expect(screen.queryByText(entry)).toBeNull();
});

test("New search leaves the chat for the Entry screen", async () => {
	await sendEntry("en", searchOf(answered([suggestion(1)])));

	fireEvent.click(
		await screen.findByRole("link", { name: labels.en.newSearch }),
	);

	expect(
		await screen.findByRole("textbox", { name: labels.en.entry }),
	).toBeDefined();
	expect(screen.queryByText("Intention number 1")).toBeNull();
	expect(screen.queryByRole("link", { name: labels.en.newSearch })).toBeNull();
});

test("the transcript is not kept: reopening the chat URL shows the Entry screen", async () => {
	await renderAt("/pray?chat=true", "en");

	expect(
		await screen.findByRole("textbox", { name: labels.en.entry }),
	).toBeDefined();
	expect(screen.queryByRole("link", { name: labels.en.newSearch })).toBeNull();
});

test.each([
	["en", "Something went wrong. Please try again."],
	["pt-BR", "Algo deu errado. Tente novamente."],
] as const)("in %s, a failed search says so", async (locale, message) => {
	await sendEntry(
		locale,
		searchOf([
			{ type: "status", data: { status: "searching" } },
			{ type: "error", data: { reason: "internal" } },
		]),
	);

	expect(await screen.findByText(message)).toBeDefined();
	expect(screen.queryByRole("status")).toBeNull();
});

const question = "Who would you like to pray for?";

const asked: SearchEvent[] = [
	{ type: "status", data: { status: "searching" } },
	{ type: "question", data: { question } },
	{ type: "done", data: {} },
];

async function answerQuestion(locale: keyof typeof labels, answer: string) {
	fireEvent.change(
		await screen.findByRole("textbox", { name: labels[locale].answer }),
		{ target: { value: answer } },
	);
	fireEvent.click(screen.getByRole("button", { name: labels[locale].send }));
}

test.each(["en", "pt-BR"] as const)(
	"in %s, the Clarifying Question is answered from the composer and the search goes on",
	async (locale) => {
		const searches = searchesOf(asked, answered([suggestion(1)]));
		await sendEntry(locale, searches.search, "pray");

		expect(await screen.findByText(question)).toBeDefined();

		await answerQuestion(locale, "My sister, she is sick");

		expect(await screen.findByText("Intention number 1")).toBeDefined();
		expect(screen.getByText("pray")).toBeDefined();
		expect(screen.getByText(question)).toBeDefined();
		expect(screen.getByText("My sister, she is sick")).toBeDefined();
		expect(
			searches.requests.map(({ entry, clarification }) => ({
				entry,
				clarification,
			})),
		).toEqual([
			{ entry: "pray", clarification: undefined },
			{
				entry: "pray",
				clarification: { question, answer: "My sister, she is sick" },
			},
		]);
		expect(
			screen.queryByRole("textbox", { name: labels[locale].answer }),
		).toBeNull();
	},
);

test("showing the Clarifying Question is counted, and its answer is neither an Entry nor a Refinement", async () => {
	const searches = searchesOf(asked, answered([suggestion(1)]));
	await sendEntry("en", searches.search, "pray");
	await screen.findByText(question);
	await answerQuestion("en", "My sister");
	await screen.findByText("Intention number 1");

	expect(events).toEqual([
		{ event: "entry_sent", properties: {} },
		{ event: "clarifying_question_shown", properties: {} },
		{ event: "suggestions_shown", properties: { count: 1, fallback: false } },
	]);
});
