import { afterEach, beforeEach, expect, test } from "bun:test";
import type { SearchEvent, Suggestion } from "@intercede/api";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { type Commit, renderAt, searchOf } from "../../test/render";
import { initAnalytics } from "../analytics";
import { rememberSubmitOrSkip, rememberSubmitted } from "../submit-gate";

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

const brotherJob: Suggestion = {
	intentionId: "0b6f6f8e-3c0e-4a8e-9a43-3f1c2d4b5a61",
	text: "For my brother's new job",
	whyNote: "About work",
};

const motherSurgery: Suggestion = {
	intentionId: "1c7a8f9e-4d1f-4b9e-8b54-4a2d3e5c6b72",
	text: "For my mother's surgery on Thursday",
	whyNote: "About health",
};

const answered: SearchEvent[] = [
	{ type: "status", data: { status: "searching" } },
	{ type: "note_delta", data: { text: "Here are some people to pray for." } },
	{ type: "suggestions", data: { suggestions: [brotherJob, motherSurgery] } },
	{ type: "done", data: {} },
];

const labels = {
	en: {
		entry: "What's in your heart to pray for today?",
		start: "Start",
		select: "Commit to pray for this intention",
		commit: "I commit!",
		committed: "You committed to pray for these intentions:",
		goodPrayer: "Have a good prayer",
		newSearch: "New search",
		ask: "Ask for prayer",
		failed: "Couldn't save your commitment.",
		retry: "Retry",
		submit: "Submit",
	},
	"pt-BR": {
		entry: "O que está no seu coração para rezar hoje?",
		start: "Começar",
		select: "Comprometer-me a rezar por esta intenção",
		commit: "Eu me comprometo!",
		committed: "Você se comprometeu a rezar por estas intenções:",
		goodPrayer: "Tenha uma boa oração",
		newSearch: "Nova busca",
		ask: "Pedir oração",
		failed: "Não foi possível salvar seu compromisso.",
		retry: "Tentar de novo",
		submit: "Enviar",
	},
} as const;

const commitsAll =
	(batches: string[][] = []): Commit =>
	async ({ intentionIds }) => {
		batches.push(intentionIds);
		return {
			ok: true,
			value: [brotherJob, motherSurgery]
				.filter((suggestion) => intentionIds.includes(suggestion.intentionId))
				.map(({ intentionId, text }) => ({ intentionId, text })),
		};
	};

async function openSuggestions(
	locale: keyof typeof labels,
	commit: Commit = commitsAll(),
) {
	const rendered = await renderAt(
		"/pray",
		locale,
		undefined,
		searchOf(answered),
		commit,
	);
	fireEvent.change(
		await screen.findByRole("textbox", { name: labels[locale].entry }),
		{ target: { value: "People who need work or healing" } },
	);
	fireEvent.click(screen.getByRole("button", { name: labels[locale].start }));
	await screen.findByText(brotherJob.text);
	return rendered;
}

const selectionBoxes = (locale: keyof typeof labels) =>
	screen.getAllByRole<HTMLInputElement>("checkbox", {
		name: labels[locale].select,
	});

test.each(["en", "pt-BR"] as const)(
	"in %s, I commit! shows only while at least one Suggestion is checked",
	async (locale) => {
		await openSuggestions(locale);
		const commit = () =>
			screen.queryByRole("button", { name: labels[locale].commit });
		const [first] = selectionBoxes(locale) as [HTMLInputElement];

		expect(commit()).toBeNull();

		fireEvent.click(first);
		expect(commit()).not.toBeNull();

		fireEvent.click(first);
		expect(commit()).toBeNull();
	},
);

test.each(["en", "pt-BR"] as const)(
	"in %s, I commit! sends the checked Suggestions as one batch and confirms them in full",
	async (locale) => {
		const batches: string[][] = [];
		await openSuggestions(locale, commitsAll(batches));
		for (const box of selectionBoxes(locale)) fireEvent.click(box);

		fireEvent.click(
			screen.getByRole("button", { name: labels[locale].commit }),
		);

		expect(await screen.findByText(labels[locale].committed)).toBeDefined();
		expect(batches).toEqual([
			[brotherJob.intentionId, motherSurgery.intentionId],
		]);
		expect(screen.getByText(brotherJob.text)).toBeDefined();
		expect(screen.getByText(motherSurgery.text)).toBeDefined();
		expect(screen.queryByText(brotherJob.whyNote)).toBeNull();
		expect(screen.getByText(labels[locale].goodPrayer)).toBeDefined();
	},
);

test.each(["en", "pt-BR"] as const)(
	"in %s, a failed commit keeps the selection and Retry sends it again",
	async (locale) => {
		const batches: string[][] = [];
		let fails = true;
		const commitsAfterAFailure: Commit = async (batch) => {
			if (fails) {
				fails = false;
				throw new Error("database unreachable");
			}
			return commitsAll(batches)(batch);
		};
		await openSuggestions(locale, commitsAfterAFailure);
		const [, second] = selectionBoxes(locale) as [
			HTMLInputElement,
			HTMLInputElement,
		];
		fireEvent.click(second);

		fireEvent.click(
			screen.getByRole("button", { name: labels[locale].commit }),
		);

		expect(await screen.findByText(labels[locale].failed)).toBeDefined();
		expect(selectionBoxes(locale).map((box) => box.checked)).toEqual([
			false,
			true,
		]);

		fireEvent.click(screen.getByRole("button", { name: labels[locale].retry }));

		expect(await screen.findByText(labels[locale].committed)).toBeDefined();
		expect(batches).toEqual([[motherSurgery.intentionId]]);
	},
);

async function commitBoth() {
	await openSuggestions("en");
	for (const box of selectionBoxes("en")) fireEvent.click(box);
	fireEvent.click(screen.getByRole("button", { name: labels.en.commit }));
	await screen.findByText(labels.en.committed);
}

test("the committed cards survive a refresh of the confirmation", async () => {
	await commitBoth();
	cleanup();

	await renderAt("/pray/committed", "en");

	expect(await screen.findByText(labels.en.committed)).toBeDefined();
	expect(screen.getByText(brotherJob.text)).toBeDefined();
	expect(screen.getByText(motherSurgery.text)).toBeDefined();
});

test("the confirmation with nothing committed in this tab goes to the Entry screen", async () => {
	await renderAt("/pray/committed", "en");

	expect(
		await screen.findByRole("textbox", { name: labels.en.entry }),
	).toBeDefined();
});

test("New search on the confirmation opens an empty Entry screen", async () => {
	await commitBoth();

	fireEvent.click(screen.getByRole("link", { name: labels.en.newSearch }));

	const textbox = await screen.findByRole<HTMLTextAreaElement>("textbox", {
		name: labels.en.entry,
	});
	expect(textbox.value).toBe("");
});

test.each(["en", "pt-BR"] as const)(
	"in %s, a Visitor who skipped submitting today is offered Ask for prayer",
	async (locale) => {
		rememberSubmitOrSkip();
		sessionStorage.setItem(
			"intercede.committedCards",
			JSON.stringify([
				{ intentionId: brotherJob.intentionId, text: brotherJob.text },
			]),
		);
		await renderAt("/pray/committed", locale);

		fireEvent.click(
			await screen.findByRole("link", { name: labels[locale].ask }),
		);

		expect(
			await screen.findByRole("button", { name: labels[locale].submit }),
		).toBeDefined();
	},
);

test("a Visitor who submitted an Intention today is not asked again", async () => {
	rememberSubmitOrSkip();
	rememberSubmitted();
	await commitBoth();

	expect(screen.getByRole("link", { name: labels.en.newSearch })).toBeDefined();
	expect(screen.queryByRole("link", { name: labels.en.ask })).toBeNull();
});

test("I commit! is counted with how many Suggestions it sends", async () => {
	await openSuggestions("en");
	const [first] = selectionBoxes("en") as [HTMLInputElement];
	fireEvent.click(first);
	events = [];

	fireEvent.click(screen.getByRole("button", { name: labels.en.commit }));
	await screen.findByText(labels.en.committed);

	expect(events).toEqual([
		{ event: "commit_clicked", properties: { count: 1 } },
	]);
});
