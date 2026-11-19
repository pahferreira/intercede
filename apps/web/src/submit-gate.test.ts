import { expect, test } from "bun:test";
import {
	rememberSubmitOrSkip,
	submittedOrSkippedRecently,
} from "./submit-gate";

const hours = (n: number) => {
	return n * 60 * 60 * 1000;
};
const now = Date.parse("2026-11-16T12:00:00Z");

test("a browser that never submitted or skipped is shown the Submit screen", () => {
	expect(submittedOrSkippedRecently(now)).toBe(false);
});

test("a submit or skip is remembered for 24 hours", () => {
	rememberSubmitOrSkip(now);

	expect(submittedOrSkippedRecently(now + hours(23))).toBe(true);
	expect(submittedOrSkippedRecently(now + hours(24))).toBe(false);
});

test("an unreadable remembered value does not hide the Submit screen", () => {
	localStorage.setItem("intercede.submittedOrSkippedAt", "yesterday");

	expect(submittedOrSkippedRecently(now)).toBe(false);
});
