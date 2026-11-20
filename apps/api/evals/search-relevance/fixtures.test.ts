import { expect, test } from "bun:test";
import { languages } from "../../src/intentions";
import { catalog } from "./catalog";
import { entries } from "./entries";

test("every relevant Intention is in the Catalog, in the Entry's Language", () => {
	const languageOf = new Map(
		catalog.map(({ key, language }) => [key, language]),
	);
	for (const entry of entries) {
		for (const key of entry.relevant) {
			expect({ key, language: languageOf.get(key) }).toEqual({
				key,
				language: entry.language,
			});
		}
	}
});

test("the fixtures cover every Language", () => {
	for (const language of languages) {
		expect(catalog.some((intention) => intention.language === language)).toBe(
			true,
		);
		expect(entries.some((entry) => entry.language === language)).toBe(true);
	}
});
