import { expect, test } from "bun:test";
import { testDatabase } from "../../test/database";
import { createDailyRateLimit, submissionsPerDay } from "./rate-limit";

const visitor = "0b6f6f8e-3c0e-4a8e-9a43-3f1c2d4b5a6e";

const at = (iso: string) => {
	const clock = { now: new Date(iso) };
	return { clock, now: () => clock.now };
};

test("the limit allows that many attempts a day, then refuses", async () => {
	const { now } = at("2026-11-18T09:00:00Z");
	const consume = createDailyRateLimit(testDatabase(), {
		action: "submission",
		limit: 2,
		now,
	});

	expect(await consume(visitor)).toBe(true);
	expect(await consume(visitor)).toBe(true);
	expect(await consume(visitor)).toBe(false);
});

test("the limit starts again on the next UTC day", async () => {
	const { clock, now } = at("2026-11-18T23:59:00Z");
	const consume = createDailyRateLimit(testDatabase(), {
		action: "submission",
		limit: 1,
		now,
	});
	await consume(visitor);
	expect(await consume(visitor)).toBe(false);

	clock.now = new Date("2026-11-19T00:01:00Z");

	expect(await consume(visitor)).toBe(true);
});

test("submissions default to 3 per Visitor a day", () => {
	expect(submissionsPerDay({})).toBe(3);
});

test("SUBMISSIONS_PER_VISITOR_PER_DAY sets the submission limit", () => {
	expect(submissionsPerDay({ SUBMISSIONS_PER_VISITOR_PER_DAY: "5" })).toBe(5);
});

test.each(["0", "-1", "2.5", "three"])(
	"SUBMISSIONS_PER_VISITOR_PER_DAY=%s is refused",
	(value) => {
		expect(() =>
			submissionsPerDay({ SUBMISSIONS_PER_VISITOR_PER_DAY: value }),
		).toThrow("SUBMISSIONS_PER_VISITOR_PER_DAY");
	},
);
