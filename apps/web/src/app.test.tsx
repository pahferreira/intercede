import { expect, test } from "bun:test";
import { fireEvent, screen, within } from "@testing-library/react";
import { renderAt } from "../test/render";

test.each([
	["/pray/committed", "Committed"],
	["/intention/INT-7K3QD", "Follow-up"],
] as const)("%s renders its stub screen", async (path, heading) => {
	await renderAt(path, "en");

	expect(await screen.findByRole("heading", { name: heading })).toBeDefined();
	expect(screen.getByRole("group", { name: "Language" })).toBeDefined();
});

test("language toggle marks the current language as pressed", async () => {
	await renderAt("/", "pt-BR");
	await screen.findByRole("heading", { name: "Envie sua intenção de oração" });

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
	await screen.findByRole("heading", { name: "Submit your prayer intention" });
	expect(
		screen.getByRole("button", { name: "English", pressed: true }),
	).toBeDefined();

	fireEvent.click(screen.getByRole("button", { name: "Português" }));

	expect(
		await screen.findByRole("heading", {
			name: "Envie sua intenção de oração",
		}),
	).toBeDefined();
	expect(localStorage.getItem("intercede.locale")).toBe("pt-BR");

	fireEvent.click(screen.getByRole("button", { name: "English" }));

	expect(
		await screen.findByRole("heading", {
			name: "Submit your prayer intention",
		}),
	).toBeDefined();
	expect(localStorage.getItem("intercede.locale")).toBe("en");
});

test("header shows the Intercede mark", async () => {
	await renderAt("/pray", "en");

	const header = await screen.findByRole("banner");
	expect(within(header).getByRole("img", { name: "Intercede" })).toBeDefined();
});
