import {
	integer,
	pgSchema,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const rateLimitedActions = [
	"submission",
	"search_turn",
	"search_tokens",
] as const;

export const platformSchema = pgSchema("platform");

export const rateLimitCounters = platformSchema.table(
	"rate_limit_counters",
	{
		action: text({ enum: rateLimitedActions }).notNull(),
		subject: text().notNull(),
		windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
		count: integer().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.action, table.subject, table.windowStart] }),
	],
);
