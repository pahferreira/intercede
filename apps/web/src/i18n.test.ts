import { expect, test } from "bun:test";
import { i18n } from "@lingui/core";
import { activateInitialLocale, resolveInitialLocale } from "./i18n";

test.each([
	["pt-BR", "pt-BR"],
	["pt-PT", "pt-BR"],
	["pt", "pt-BR"],
	["en-US", "en"],
	["fr-FR", "en"],
] as const)(
	"first visit with browser language %s uses %s",
	(browser, expected) => {
		expect(resolveInitialLocale(null, browser)).toBe(expected);
	},
);

test("a remembered language wins over the browser language", () => {
	expect(resolveInitialLocale("en", "pt-BR")).toBe("en");
	expect(resolveInitialLocale("pt-BR", "en-US")).toBe("pt-BR");
});

test("an unknown remembered language falls back to the browser language", () => {
	expect(resolveInitialLocale("de", "pt-BR")).toBe("pt-BR");
});

function useBrowserLanguage(language: string) {
	Object.defineProperty(navigator, "language", {
		value: language,
		configurable: true,
	});
}

test("first visit remembers the language picked from the browser", async () => {
	useBrowserLanguage("pt-BR");

	await activateInitialLocale();

	expect(i18n.locale).toBe("pt-BR");
	expect(localStorage.getItem("intercede.locale")).toBe("pt-BR");
});

test("a language whose catalog fails to load falls back to English", async () => {
	localStorage.setItem("intercede.locale", "pt-BR");

	await activateInitialLocale(async (locale) => {
		if (locale === "pt-BR") {
			throw new Error("chunk failed to load");
		}
		return {};
	});

	expect(i18n.locale).toBe("en");
});
