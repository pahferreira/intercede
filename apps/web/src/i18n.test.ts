import { expect, test } from "bun:test";
import { resolveInitialLocale } from "./i18n";

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
