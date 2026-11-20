import { and, eq, sql } from "drizzle-orm";
import type { Database } from "./database";
import type { ConsumeRateLimit } from "./rate-limit-port";
import { rateLimitCounters, type rateLimitedActions } from "./schema";

type Env = Record<string, string | undefined>;

export const positiveIntegerSetting = (
	env: Env,
	name: string,
	fallback: number,
) => {
	const configured = env[name];
	if (configured === undefined) return fallback;
	const value = Number(configured);
	if (!Number.isInteger(value) || value < 1) {
		throw new Error(`${name} must be a positive integer`);
	}
	return value;
};

export const submissionsPerDay = (env: Env = process.env) => {
	return positiveIntegerSetting(env, "SUBMISSIONS_PER_VISITOR_PER_DAY", 3);
};

export const searchTurnsPerHour = (env: Env = process.env) => {
	return positiveIntegerSetting(env, "SEARCH_TURNS_PER_VISITOR_PER_HOUR", 20);
};

const windowStarts = {
	day: (at: Date) => {
		return new Date(
			Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()),
		);
	},
	hour: (at: Date) => {
		return new Date(
			Date.UTC(
				at.getUTCFullYear(),
				at.getUTCMonth(),
				at.getUTCDate(),
				at.getUTCHours(),
			),
		);
	},
};

type CounterOptions = {
	action: (typeof rateLimitedActions)[number];
	per: keyof typeof windowStarts;
	now?: () => Date;
};

export const addToCounter = async (
	database: Database,
	{ action, per, now = () => new Date() }: CounterOptions,
	subject: string,
	amount: number,
) => {
	const [counter] = await database
		.insert(rateLimitCounters)
		.values({
			action,
			subject,
			windowStart: windowStarts[per](now()),
			count: amount,
		})
		.onConflictDoUpdate({
			target: [
				rateLimitCounters.action,
				rateLimitCounters.subject,
				rateLimitCounters.windowStart,
			],
			set: { count: sql`${rateLimitCounters.count} + ${amount}` },
		})
		.returning({ count: rateLimitCounters.count });
	if (!counter) throw new Error("the rate limit counter was not written");
	return counter.count;
};

export const readCounter = async (
	database: Database,
	{ action, per, now = () => new Date() }: CounterOptions,
	subject: string,
) => {
	const [counter] = await database
		.select({ count: rateLimitCounters.count })
		.from(rateLimitCounters)
		.where(
			and(
				eq(rateLimitCounters.action, action),
				eq(rateLimitCounters.subject, subject),
				eq(rateLimitCounters.windowStart, windowStarts[per](now())),
			),
		);
	return counter?.count ?? 0;
};

type RateLimitOptions = CounterOptions & { limit: number };

export const createRateLimit =
	(database: Database, options: RateLimitOptions): ConsumeRateLimit =>
	async (subject) => {
		return (await addToCounter(database, options, subject, 1)) <= options.limit;
	};

export const createSubmissionLimit = (
	database: Database,
	env: Env = process.env,
) => {
	return createRateLimit(database, {
		action: "submission",
		per: "day",
		limit: submissionsPerDay(env),
	});
};

export const createSearchTurnLimit = (
	database: Database,
	env: Env = process.env,
) => {
	return createRateLimit(database, {
		action: "search_turn",
		per: "hour",
		limit: searchTurnsPerHour(env),
	});
};
