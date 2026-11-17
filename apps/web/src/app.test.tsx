import { expect, test } from "bun:test";
import { createApp } from "@intercede/api/testing";
import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createApiClient } from "./api";
import { App } from "./app";
import { type Locale, switchLocale } from "./i18n";

async function renderAt(path: string, locale: Locale) {
	await switchLocale(locale);
	const app = createApp({
		isDatabaseReachable: async () => true,
		openAnalytics: () => ({
			captureException: () => {},
			captureLlmGeneration: () => {},
			shutdown: async () => {},
		}),
	});
	const client = createApiClient(app.request);
	const history = createMemoryHistory({ initialEntries: [path] });
	return render(<App client={client} history={history} />);
}

test("placeholder page shows the API health in English", async () => {
	await renderAt("/", "en");

	expect(await screen.findByText("API status: ok")).toBeDefined();
});

test("placeholder page shows the API health in Portuguese", async () => {
	await renderAt("/", "pt-BR");

	expect(await screen.findByText("Status da API: ok")).toBeDefined();
});

test.each([
	["/pray", "Pray"],
	["/pray/committed", "Committed"],
	["/f/abc123", "Follow-up"],
] as const)("%s renders its stub screen", async (path, heading) => {
	await renderAt(path, "en");

	expect(await screen.findByRole("heading", { name: heading })).toBeDefined();
	expect(screen.getByRole("group", { name: "Language" })).toBeDefined();
});

test("language toggle marks the current language as pressed", async () => {
	await renderAt("/", "pt-BR");
	await screen.findByText("Status da API: ok");

	const group = screen.getByRole("group", { name: "Idioma" });
	expect(group).toBeDefined();
	expect(
		screen.getByRole("button", { name: "Português", pressed: true }),
	).toBeDefined();
	expect(
		screen.getByRole("button", { name: "English", pressed: false }),
	).toBeDefined();
});

test("language toggle switches the page language and remembers it", async () => {
	await renderAt("/", "en");
	await screen.findByText("API status: ok");
	expect(
		screen.getByRole("button", { name: "English", pressed: true }),
	).toBeDefined();

	fireEvent.click(screen.getByRole("button", { name: "Português" }));

	expect(await screen.findByText("Status da API: ok")).toBeDefined();
	expect(localStorage.getItem("intercede.locale")).toBe("pt-BR");

	fireEvent.click(screen.getByRole("button", { name: "English" }));

	expect(await screen.findByText("API status: ok")).toBeDefined();
	expect(localStorage.getItem("intercede.locale")).toBe("en");
});

test("header shows the Intercede mark", async () => {
	await renderAt("/pray", "en");

	const header = await screen.findByRole("banner");
	expect(within(header).getByRole("img", { name: "Intercede" })).toBeDefined();
});
