import { afterEach, beforeEach, expect, test } from "bun:test";
import type { SearchEvent, Suggestion, SuggestionMatch } from "@intercede/api";
import { fireEvent, screen } from "@testing-library/react";
import {
	controlledSearch,
	renderAt,
	type Search,
	searchesOf,
	searchOf,
} from "../../test/render";
import { installTurnstile } from "../../test/turnstile";
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

function answered(
	suggestions: Suggestion[],
	match: SuggestionMatch = "close",
): SearchEvent[] {
	return [
		{ type: "status", data: { status: "searching" } },
		{ type: "note_delta", data: { text: "Here are some " } },
		{ type: "note_delta", data: { text: "people to pray for." } },
		{ type: "suggestions", data: { match, suggestions } },
		{ type: "done", data: {} },
	];
}

const labels = {
	en: {
		entry: "What would you like to pray for today?",
		start: "Start",
		newSearch: "New search",
		commit: "Commit to pray for this intention",
		answer: "Tell me more…",
		send: "Send",
	},
	"pt-BR": {
		entry: "Pelo que você quer interceder hoje?",
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

const fallbackCopy = {
	en: {
		noMatch:
			"I couldn't find a close match. These are still waiting for prayer:",
		empty: "No intentions yet.",
		askForPrayer: "Be the first to ask for prayer",
	},
	"pt-BR": {
		noMatch:
			"Não encontrei nada muito próximo. Estas intenções ainda esperam por oração:",
		empty: "Ainda não há intenções.",
		askForPrayer: "Seja a primeira pessoa a pedir oração",
	},
} as const;

function unattended(n: number): Suggestion {
	return { intentionId: `intention-${n}`, text: `Intention number ${n}` };
}

test.each(["en", "pt-BR"] as const)(
	"in %s, with no close match the Intentions still waiting for prayer are shown to commit to",
	async (locale) => {
		await sendEntry(
			locale,
			searchOf(answered([unattended(1), unattended(2)], "fallback")),
		);

		expect(await screen.findByText(fallbackCopy[locale].noMatch)).toBeDefined();
		expect(screen.getByText("Intention number 2")).toBeDefined();
		expect(
			screen.getAllByRole("checkbox", { name: labels[locale].commit }),
		).toHaveLength(2);
	},
);

test("showing the fallback Intentions is counted as a fallback", async () => {
	await sendEntry("en", searchOf(answered([1, 2].map(unattended), "fallback")));
	await screen.findByText("Intention number 2");

	expect(events).toEqual([
		{ event: "entry_sent", properties: {} },
		{ event: "suggestions_shown", properties: { count: 2, fallback: true } },
	]);
});

test.each(["en", "pt-BR"] as const)(
	"in %s, an empty Catalog says so and links to asking for prayer",
	async (locale) => {
		await sendEntry(locale, searchOf(answered([], "empty_catalog")));

		expect(await screen.findByText(fallbackCopy[locale].empty)).toBeDefined();
		expect(screen.queryByText(fallbackCopy[locale].noMatch)).toBeNull();
		expect(
			screen
				.getByRole("link", { name: fallbackCopy[locale].askForPrayer })
				.getAttribute("href"),
		).toBe("/?ask=true");
	},
);

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

test("an Entry that fails Turnstile is not searched, and says so", async () => {
	installTurnstile().passes = false;
	const searches = searchesOf();
	await sendEntry("en", searches.search);

	expect(
		await screen.findByText("Something went wrong. Please try again."),
	).toBeDefined();
	expect(searches.requests).toEqual([]);
});

test("a New search after the first gets a fresh Turnstile token", async () => {
	const searches = searchesOf(
		answered([suggestion(1)]),
		answered([suggestion(2)]),
	);
	await sendEntry("en", searches.search);
	fireEvent.click(
		await screen.findByRole("link", { name: labels.en.newSearch }),
	);
	fireEvent.change(
		await screen.findByRole("textbox", { name: labels.en.entry }),
		{ target: { value: "Another Entry" } },
	);
	fireEvent.click(screen.getByRole("button", { name: labels.en.start }));
	await screen.findByText("Intention number 2");

	expect(searches.requests.map((request) => request.turnstileToken)).toEqual([
		"turnstile-token-1",
		"turnstile-token-2",
	]);
});

const limitCopy = {
	en: "You've searched a lot today. Come back later. Meanwhile, the intentions you committed to are waiting for your prayer.",
	"pt-BR":
		"Você já buscou bastante hoje. Volte mais tarde. Enquanto isso, as intenções com que você se comprometeu esperam pela sua oração.",
} as const;

test.each(["en", "pt-BR"] as const)(
	"in %s, a search past the limit says so and disables the composer",
	async (locale) => {
		await sendEntry(
			locale,
			searchOf([{ type: "error", data: { reason: "limit_reached" } }]),
		);

		expect(await screen.findByText(limitCopy[locale])).toBeDefined();
		const composer = screen.getByRole("textbox", {
			name: labels[locale].answer,
		}) as HTMLTextAreaElement;
		expect(composer.disabled).toBe(true);
		expect(
			screen.queryByText("Something went wrong. Please try again."),
		).toBeNull();
	},
);

const question = "Who would you like to pray for?";

const asked: SearchEvent[] = [
	{ type: "status", data: { status: "searching" } },
	{ type: "question", data: { question, signature: "signed-transcript" } },
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
			searches.requests.map(({ entry, turnstileToken, clarification }) => ({
				entry,
				turnstileToken,
				clarification,
			})),
		).toEqual([
			{
				entry: "pray",
				turnstileToken: "turnstile-token-1",
				clarification: undefined,
			},
			{
				entry: "pray",
				turnstileToken: undefined,
				clarification: {
					question,
					answer: "My sister, she is sick",
					signature: "signed-transcript",
				},
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

function signed(events: SearchEvent[], signature: string): SearchEvent[] {
	return events.map((event) =>
		event.type === "suggestions"
			? { ...event, data: { ...event.data, signature } }
			: event,
	);
}

const refineLabel = {
	en: "Tell me more, or refine your search…",
	"pt-BR": "Conte-me mais ou refine sua busca…",
} as const;

async function refine(locale: keyof typeof labels, text: string) {
	fireEvent.change(
		await screen.findByRole("textbox", { name: refineLabel[locale] }),
		{ target: { value: text } },
	);
	fireEvent.click(screen.getByRole("button", { name: labels[locale].send }));
}

test.each(["en", "pt-BR"] as const)(
	"in %s, a Refinement from the composer sends the signed transcript and the thread goes on",
	async (locale) => {
		const searches = searchesOf(
			signed(answered([suggestion(1)]), "signed-after-entry"),
			signed(answered([suggestion(2)]), "signed-after-refinement"),
		);
		await sendEntry(locale, searches.search);
		await screen.findByText("Intention number 1");

		await refine(locale, "  More about family  ");

		expect(await screen.findByText("Intention number 2")).toBeDefined();
		expect(screen.getByText(entry)).toBeDefined();
		expect(screen.getByText("Intention number 1")).toBeDefined();
		expect(screen.getByText("More about family")).toBeDefined();
		expect(searches.requests[1]).toEqual({
			entry: "More about family",
			turnstileToken: undefined,
			clarification: undefined,
			transcript: {
				turns: [
					{
						entry,
						note: "Here are some people to pray for.",
						suggestions: [suggestion(1)],
					},
				],
				signature: "signed-after-entry",
			},
			visitorId: expect.any(String),
		});
	},
);

test("each Refinement is counted with its number", async () => {
	const searches = searchesOf(
		signed(answered([suggestion(1)]), "signed-1"),
		signed(answered([suggestion(2)]), "signed-2"),
		answered([suggestion(3)]),
	);
	await sendEntry("en", searches.search);
	await screen.findByText("Intention number 1");
	await refine("en", "More about family");
	await screen.findByText("Intention number 2");
	await refine("en", "My cousin");
	await screen.findByText("Intention number 3");

	expect(events.filter((event) => event.event === "refinement_sent")).toEqual([
		{ event: "refinement_sent", properties: { n: 1 } },
		{ event: "refinement_sent", properties: { n: 2 } },
	]);
	expect(searches.requests[2]?.transcript).toEqual({
		turns: [
			{
				entry,
				note: "Here are some people to pray for.",
				suggestions: [suggestion(1)],
			},
			{
				entry: "More about family",
				note: "Here are some people to pray for.",
				suggestions: [suggestion(2)],
			},
		],
		signature: "signed-2",
	});
});

test.each(["en", "pt-BR"] as const)(
	"in %s, after the second Refinement the composer becomes a New search button",
	async (locale) => {
		await sendEntry(
			locale,
			searchesOf(
				signed(answered([suggestion(1)]), "signed-1"),
				signed(answered([suggestion(2)]), "signed-2"),
				answered([suggestion(3)]),
			).search,
		);
		await screen.findByText("Intention number 1");
		await refine(locale, "More about family");
		await screen.findByText("Intention number 2");
		await refine(locale, "My cousin");
		await screen.findByText("Intention number 3");

		expect(
			screen.queryByRole("textbox", { name: refineLabel[locale] }),
		).toBeNull();
		fireEvent.click(
			screen.getByRole("button", { name: labels[locale].newSearch }),
		);

		expect(
			await screen.findByRole("textbox", { name: labels[locale].entry }),
		).toBeDefined();
		expect(screen.queryByText("Intention number 3")).toBeNull();
	},
);
