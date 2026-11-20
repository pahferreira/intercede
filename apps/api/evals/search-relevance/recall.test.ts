import { expect, test } from "bun:test";
import { recallAt } from "./recall";

test("recall@5 is the share of relevant Intentions ranked in the first five", () => {
	const ranked = ["a", "x", "b", "y", "z", "c"];

	expect(recallAt(5, ranked, ["a", "b", "c", "d"])).toBe(0.5);
});

test("recall@5 is 1 when every relevant Intention is ranked in the first five", () => {
	expect(recallAt(5, ["b", "a"], ["a", "b"])).toBe(1);
});

test("recall@5 is 0 when nothing relevant is ranked", () => {
	expect(recallAt(5, [], ["a"])).toBe(0);
});
