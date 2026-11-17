import { expect, mock, test } from "bun:test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { type Locale, switchLocale } from "../i18n";
import { AssistantReply, SearchingStatus, UserPrompt } from "./Message";

async function renderIn(locale: Locale, children: ReactNode) {
	await switchLocale(locale);
	return render(<I18nProvider i18n={i18n}>{children}</I18nProvider>);
}

test("Retry on a failed prompt calls its handler", async () => {
	const onRetry = mock();
	await renderIn(
		"en",
		<UserPrompt text="Pray for my mother" state="failed" onRetry={onRetry} />,
	);

	fireEvent.click(screen.getByRole("button", { name: "Retry" }));

	expect(onRetry).toHaveBeenCalledTimes(1);
});

test.each([
	["en", "Looking for intentions…"],
	["pt-BR", "Procurando intenções…"],
] as const)("the searching line is a status in %s", async (locale, text) => {
	await renderIn(locale, <SearchingStatus />);

	expect(screen.getByRole("status").textContent).toBe(text);
});

test("the assistant reply is a polite live region", async () => {
	await renderIn(
		"en",
		<AssistantReply
			paragraphs={["I found three intentions close to yours.", "Pick one."]}
			streaming
		/>,
	);

	const reply = screen.getByText("Pick one.").parentElement;
	expect(reply?.getAttribute("aria-live")).toBe("polite");
	expect(reply?.textContent).toBe(
		"I found three intentions close to yours.Pick one.",
	);
});

test.each([
	["en", "Sending…"],
	["pt-BR", "Enviando…"],
] as const)("a sending prompt says so in %s", async (locale, sending) => {
	await renderIn(
		locale,
		<UserPrompt text="Pray for my mother" state="sending" />,
	);

	expect(screen.getByText("Pray for my mother")).toBeDefined();
	expect(screen.getByText(sending)).toBeDefined();
});

test.each([
	["en", "Not sent.", "Retry"],
	["pt-BR", "Não enviada.", "Tentar de novo"],
] as const)("a failed prompt says so in %s", async (locale, failed, retry) => {
	await renderIn(
		locale,
		<UserPrompt text="Pray for my mother" state="failed" onRetry={mock()} />,
	);

	expect(screen.getByText(failed)).toBeDefined();
	expect(screen.getByRole("button", { name: retry })).toBeDefined();
});

test("a sent prompt keeps the visitor's line breaks and shows no meta line", async () => {
	await renderIn("en", <UserPrompt text={"Pray for my mother\nand my aunt"} />);

	expect(
		screen.getByText("Pray for my mother\nand my aunt", {
			normalizer: (text) => text,
		}),
	).toBeDefined();
	expect(screen.queryByText("Sending…")).toBeNull();
	expect(screen.queryByRole("button")).toBeNull();
});
