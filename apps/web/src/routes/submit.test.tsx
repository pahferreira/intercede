import { afterEach, beforeEach, expect, test } from "bun:test";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderAt, type SubmitIntention } from "../../test/render";
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

const eventNames = () => events.map(({ event }) => event);

const published = { code: "INT-7K3QD" };

const publishes: SubmitIntention = async () => ({
	ok: true,
	value: published,
});

const rejects =
	(...reasons: ("spam" | "abuse" | "personal_data" | "off_topic")[]) =>
	async () => ({
		ok: false as const,
		error: { kind: "rejected" as const, reasons },
	});

const textbox = () => screen.getByRole("textbox") as HTMLTextAreaElement;

async function write(text: string) {
	const field = (await screen.findByRole("textbox")) as HTMLTextAreaElement;
	fireEvent.change(field, { target: { value: text } });
}

test("the Submit screen is shown and counted as viewed", async () => {
	await renderAt("/", "en");

	expect(
		await screen.findByRole("heading", {
			name: "Submit your prayer intention",
		}),
	).toBeDefined();
	expect(screen.getByText("Welcome to")).toBeDefined();
	expect(eventNames()).toEqual(["submit_viewed"]);
});

test("the Submit screen is shown in Portuguese", async () => {
	await renderAt("/", "pt-BR");

	expect(
		await screen.findByRole("heading", {
			name: "Envie sua intenção de oração",
		}),
	).toBeDefined();
	expect(screen.getByRole("button", { name: "Pular" })).toBeDefined();
	expect(screen.getByRole("button", { name: "Enviar" })).toBeDefined();
});

test("Submit stays disabled until the text has 10 characters", async () => {
	await renderAt("/", "en");

	await write("   too short   ");
	expect(
		(screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement)
			.disabled,
	).toBe(true);

	await write("For my brother's new job");
	expect(
		(screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement)
			.disabled,
	).toBe(false);
});

test("the text is locked while moderation runs", async () => {
	const moderation = Promise.withResolvers<void>();
	await renderAt("/", "en", async () => {
		await moderation.promise;
		return { ok: true, value: published };
	});
	await write("For my brother's new job");

	fireEvent.click(screen.getByRole("button", { name: "Submit" }));

	expect(
		await screen.findByRole("button", { name: "Submitting…" }),
	).toBeDefined();
	expect(textbox().readOnly).toBe(true);
	moderation.resolve();
	expect(await screen.findByRole("heading", { name: "Pray" })).toBeDefined();
});

test("a published Intention goes to /pray and is counted", async () => {
	const submitted: { text: string; turnstileToken: string }[] = [];
	await renderAt("/", "en", async ({ text, turnstileToken }) => {
		submitted.push({ text, turnstileToken });
		return { ok: true, value: published };
	});
	await write("For my brother's new job");

	fireEvent.click(screen.getByRole("button", { name: "Submit" }));

	expect(await screen.findByRole("heading", { name: "Pray" })).toBeDefined();
	expect(submitted).toEqual([
		{
			text: "For my brother's new job",
			turnstileToken: "turnstile-token-1",
		},
	]);
	expect(eventNames()).toEqual(["submit_viewed", "intention_submitted"]);
});

test.each([
	[
		"en",
		"Submit",
		"Use initials instead of full names, and leave out contact details.",
		"Keep it respectful: leave out insults and offensive language.",
	],
	[
		"pt-BR",
		"Enviar",
		"Use iniciais em vez de nomes completos e não inclua dados de contato.",
		"Mantenha o respeito: não use insultos nem linguagem ofensiva.",
	],
] as const)(
	"a rejection in %s shows its reasons as hints and keeps the text",
	async (locale, submit, personalDataHint, abuseHint) => {
		await renderAt("/", locale, rejects("personal_data", "abuse"));
		await write("Pray for John Smith, 555-0100");

		fireEvent.click(screen.getByRole("button", { name: submit }));

		expect(await screen.findByText(personalDataHint)).toBeDefined();
		expect(screen.getByText(abuseHint)).toBeDefined();
		expect(textbox().value).toBe("Pray for John Smith, 555-0100");
		expect(textbox().readOnly).toBe(false);
	},
);

test.each([
	["spam", "Leave out links, ads and repeated text."],
	["off_topic", "Share something you'd like others to pray for."],
] as const)("a %s rejection has its own hint", async (reason, hint) => {
	await renderAt("/", "en", rejects(reason));
	await write("Buy cheap watches at example.com");

	fireEvent.click(screen.getByRole("button", { name: "Submit" }));

	expect(await screen.findByText(hint)).toBeDefined();
});

test("each rejection reason is counted, never the text", async () => {
	await renderAt("/", "en", rejects("personal_data", "spam"));
	await write("Pray for John Smith, 555-0100");

	fireEvent.click(screen.getByRole("button", { name: "Submit" }));
	await screen.findByText("Leave out links, ads and repeated text.");

	expect(events).toEqual([
		{ event: "submit_viewed", properties: {} },
		{ event: "intention_rejected", properties: { reason: "personal_data" } },
		{ event: "intention_rejected", properties: { reason: "spam" } },
	]);
});

test.each([
	[
		"en",
		"Submit",
		"We couldn't check your intention right now. Please try again in a moment.",
	],
	[
		"pt-BR",
		"Enviar",
		"Não conseguimos verificar sua intenção agora. Tente novamente em instantes.",
	],
] as const)(
	"an unavailable moderation in %s asks to try again and keeps the text",
	async (locale, submit, message) => {
		await renderAt("/", locale, async () => ({
			ok: false,
			error: { kind: "moderation_unavailable" },
		}));
		await write("For my brother's new job");

		fireEvent.click(screen.getByRole("button", { name: submit }));

		expect(await screen.findByText(message)).toBeDefined();
		expect(textbox().value).toBe("For my brother's new job");
	},
);

test("Skip goes to /pray and is counted", async () => {
	await renderAt("/", "en");

	fireEvent.click(await screen.findByRole("button", { name: "Skip" }));

	expect(await screen.findByRole("heading", { name: "Pray" })).toBeDefined();
	expect(eventNames()).toEqual(["submit_viewed", "submit_skipped"]);
});

test("after a skip, / goes straight to /pray", async () => {
	const first = await renderAt("/", "en");
	fireEvent.click(await screen.findByRole("button", { name: "Skip" }));
	await screen.findByRole("heading", { name: "Pray" });
	first.unmount();

	await renderAt("/", "en");

	expect(await screen.findByRole("heading", { name: "Pray" })).toBeDefined();
});

test("after a submit, / goes straight to /pray", async () => {
	const first = await renderAt("/", "en", publishes);
	await write("For my brother's new job");
	fireEvent.click(screen.getByRole("button", { name: "Submit" }));
	await screen.findByRole("heading", { name: "Pray" });
	first.unmount();

	await renderAt("/", "en");

	expect(await screen.findByRole("heading", { name: "Pray" })).toBeDefined();
});

test.each([
	["en", "Skip", "Ask for prayer", "Submit your prayer intention"],
	["pt-BR", "Pular", "Pedir oração", "Envie sua intenção de oração"],
] as const)(
	"Ask for prayer in %s opens the Submit screen even after a skip",
	async (locale, skip, ask, heading) => {
		await renderAt("/", locale);
		fireEvent.click(await screen.findByRole("button", { name: skip }));

		fireEvent.click(await screen.findByRole("link", { name: ask }));

		expect(await screen.findByRole("heading", { name: heading })).toBeDefined();
	},
);

test("each submission asks Turnstile for a fresh token", async () => {
	const tokens: string[] = [];
	await renderAt("/", "en", async ({ turnstileToken }) => {
		tokens.push(turnstileToken);
		return { ok: false, error: { kind: "rejected", reasons: ["spam"] } };
	});
	await write("Buy cheap watches at example.com");

	fireEvent.click(screen.getByRole("button", { name: "Submit" }));
	await screen.findByText("Leave out links, ads and repeated text.");
	fireEvent.click(screen.getByRole("button", { name: "Submit" }));

	await waitFor(() =>
		expect(tokens).toEqual(["turnstile-token-1", "turnstile-token-2"]),
	);
});

test.each([
	["en", "Submit", "Couldn't verify, try again."],
	["pt-BR", "Enviar", "Não foi possível verificar. Tente novamente."],
] as const)(
	"a failed Turnstile check on the server in %s asks to try again and keeps the text",
	async (locale, submit, message) => {
		await renderAt("/", locale, async () => ({
			ok: false,
			error: { kind: "verification_failed" },
		}));
		await write("For my brother's new job");

		fireEvent.click(screen.getByRole("button", { name: submit }));

		expect(await screen.findByText(message)).toBeDefined();
		expect(textbox().value).toBe("For my brother's new job");
		expect(textbox().readOnly).toBe(false);
	},
);

test("a Turnstile challenge that fails in the browser asks to try again without submitting", async () => {
	installTurnstile().passes = false;
	await renderAt("/", "en");
	await write("For my brother's new job");

	fireEvent.click(screen.getByRole("button", { name: "Submit" }));

	expect(await screen.findByText("Couldn't verify, try again.")).toBeDefined();
	expect(textbox().value).toBe("For my brother's new job");
});

test.each([
	[
		"en",
		"Submit",
		"Skip",
		"Pray",
		"You've reached today's limit for intentions. Come back tomorrow, or skip to pray for others.",
	],
	[
		"pt-BR",
		"Enviar",
		"Pular",
		"Rezar",
		"Você atingiu o limite de intenções de hoje. Volte amanhã ou pule para rezar pelos outros.",
	],
] as const)(
	"a reached submission limit in %s is shown inline and Skip still works",
	async (locale, submit, skip, pray, message) => {
		await renderAt("/", locale, async () => ({
			ok: false,
			error: { kind: "limit_reached" },
		}));
		await write("For my brother's new job");

		fireEvent.click(screen.getByRole("button", { name: submit }));
		expect(await screen.findByText(message)).toBeDefined();
		expect(textbox().value).toBe("For my brother's new job");

		fireEvent.click(screen.getByRole("button", { name: skip }));

		expect(await screen.findByRole("heading", { name: pray })).toBeDefined();
	},
);
