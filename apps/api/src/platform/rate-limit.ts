import { sql } from "drizzle-orm";
import type { Database } from "./database";
import type { ConsumeRateLimit } from "./rate-limit-port";
import { rateLimitCounters, type rateLimitedActions } from "./schema";

type Env = Record<string, string | undefined>;

const defaultSubmissionsPerDay = 3;

export const submissionsPerDay = (env: Env = process.env) => {
	const configured = env.SUBMISSIONS_PER_VISITOR_PER_DAY;
	if (configured === undefined) return defaultSubmissionsPerDay;
	const limit = Number(configured);
	if (!Number.isInteger(limit) || limit < 1) {
		throw new Error(
			"SUBMISSIONS_PER_VISITOR_PER_DAY must be a positive integer",
		);
	}
	return limit;
};

const startOfUtcDay = (at: Date) =>
	new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));

export const createDailyRateLimit =
	(
		database: Database,
		{
			action,
			limit,
			now = () => new Date(),
		}: {
			action: (typeof rateLimitedActions)[number];
			limit: number;
			now?: () => Date;
		},
	): ConsumeRateLimit =>
	async (subject) => {
		const [counter] = await database
			.insert(rateLimitCounters)
			.values({ action, subject, windowStart: startOfUtcDay(now()), count: 1 })
			.onConflictDoUpdate({
				target: [
					rateLimitCounters.action,
					rateLimitCounters.subject,
					rateLimitCounters.windowStart,
				],
				set: { count: sql`${rateLimitCounters.count} + 1` },
			})
			.returning({ count: rateLimitCounters.count });
		if (!counter) throw new Error("the rate limit counter was not written");
		return counter.count <= limit;
	};
