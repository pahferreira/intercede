import { expect, test } from "bun:test";
import { testDatabase } from "../../test/database";
import { createDailyTokenBudget, searchTokensPerDay } from "./token-budget";

test("the budget is spent once the day's tokens reach the limit, and starts again the next UTC day", async () => {
	const clock = { now: new Date("2026-11-18T23:00:00Z") };
	const budget = createDailyTokenBudget(testDatabase(), {
		limit: 1000,
		now: () => clock.now,
	});
	await budget.spend(600);
	expect(await budget.isSpent()).toBe(false);
	await budget.spend(400);
	expect(await budget.isSpent()).toBe(true);

	clock.now = new Date("2026-11-19T00:00:00Z");

	expect(await budget.isSpent()).toBe(false);
});

test("searches default to 2,000,000 tokens a day", () => {
	expect(searchTokensPerDay({})).toBe(2_000_000);
});

test("SEARCH_TOKENS_PER_DAY sets the daily token budget", () => {
	expect(searchTokensPerDay({ SEARCH_TOKENS_PER_DAY: "500000" })).toBe(500_000);
});

test("SEARCH_TOKENS_PER_DAY must be a positive integer", () => {
	expect(() => searchTokensPerDay({ SEARCH_TOKENS_PER_DAY: "0" })).toThrow(
		"SEARCH_TOKENS_PER_DAY",
	);
});
