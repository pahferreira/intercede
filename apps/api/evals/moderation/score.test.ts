import { expect, test } from "bun:test";
import { score } from "./score";

test("a reason flagged on exactly the intentions labelled with it scores full precision and recall", () => {
	const scores = score([
		{
			labelled: ["spam"],
			verdict: { publishable: false, reasons: ["spam"] },
		},
		{
			labelled: [],
			verdict: { publishable: true, language: "en" },
		},
	]);

	expect(scores.spam).toEqual({ precision: 1, recall: 1 });
});

test("a reason that misses labelled intentions and flags allowed ones loses recall and precision", () => {
	const scores = score([
		{
			labelled: ["abuse"],
			verdict: { publishable: false, reasons: ["abuse"] },
		},
		{
			labelled: ["abuse"],
			verdict: { publishable: true, language: "pt" },
		},
		{
			labelled: [],
			verdict: { publishable: false, reasons: ["abuse"] },
		},
		{
			labelled: ["spam"],
			verdict: { publishable: false, reasons: ["spam", "abuse"] },
		},
	]);

	expect(scores.abuse.precision).toBeCloseTo(1 / 3);
	expect(scores.abuse.recall).toBe(0.5);
});

test("a reason never flagged has no precision and a reason never labelled has no recall", () => {
	const scores = score([
		{
			labelled: ["personal_data"],
			verdict: { publishable: false, reasons: ["off_topic"] },
		},
	]);

	expect(scores.personal_data).toEqual({ precision: null, recall: 0 });
	expect(scores.off_topic).toEqual({ precision: 0, recall: null });
});
