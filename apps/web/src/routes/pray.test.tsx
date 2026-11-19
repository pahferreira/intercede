import { afterEach, beforeEach, expect, test } from "bun:test";
import { fireEvent, screen } from "@testing-library/react";
import { renderAt, type SubmitIntention } from "../../test/render";
import { initAnalytics } from "../analytics";

const entryLabel = "What's in your heart to pray for today?";

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

const publishes: SubmitIntention = async () => {
	return {
		ok: true,
		value: { code: "INT-7K3QD" },
	};
};

async function publish(locale: "en" | "pt-BR", submit: string) {
	const rendered = await renderAt("/", locale, publishes);
	fireEvent.change(await screen.findByRole("textbox"), {
		target: { value: "For my brother's new job" },
	});
	fireEvent.click(screen.getByRole("button", { name: submit }));
	return rendered;
}

test.each([
	["en", "Submit", "Intention INT-7K3QD", "Copy link"],
	["pt-BR", "Enviar", "Intenção INT-7K3QD", "Copiar link"],
] as const)(
	"after publishing in %s, /pray confirms it with the Intention Code",
	async (locale, submit, confirmation, copy) => {
		await publish(locale, submit);

		expect(await screen.findByText(confirmation)).toBeDefined();
		expect(screen.getByRole("button", { name: copy })).toBeDefined();
	},
);

test("Copy link puts the follow-up link on the clipboard and is counted", async () => {
	await publish("en", "Submit");

	fireEvent.click(await screen.findByRole("button", { name: "Copy link" }));

	expect(await screen.findByRole("button", { name: "Copied" })).toBeDefined();
	expect(await navigator.clipboard.readText()).toBe(
		"http://localhost/intention/INT-7K3QD",
	);
	expect(events.map(({ event }) => event)).toContain("followup_link_copied");
});

test("the Intention Code is kept in localStorage", async () => {
	await publish("en", "Submit");
	await screen.findByText("Intention INT-7K3QD");

	expect(
		JSON.parse(localStorage.getItem("intercede.intentionCodes") ?? ""),
	).toEqual(["INT-7K3QD"]);
});

test("the confirmation stays until it is dismissed", async () => {
	const first = await publish("en", "Submit");
	await screen.findByText("Intention INT-7K3QD");
	first.unmount();

	await renderAt("/pray", "en");
	fireEvent.click(await screen.findByRole("button", { name: "Dismiss" }));

	expect(screen.queryByText("Intention INT-7K3QD")).toBeNull();
	expect(screen.getByRole("textbox", { name: entryLabel })).toBeDefined();
	expect(localStorage.getItem("intercede.intentionCodes")).not.toBeNull();
});

test("/pray reached without publishing shows no confirmation", async () => {
	await renderAt("/pray", "en");

	await screen.findByRole("textbox", { name: entryLabel });
	expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();
});
