import { jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { languages } from "../../domain/intention";
import { intentionEventTypes } from "../../domain/intention-event";

export const intentionsSchema = pgSchema("intentions");

export const intentions = intentionsSchema.table("intentions", {
	id: uuid().primaryKey().defaultRandom(),
	code: text().notNull().unique(),
	text: text().notNull(),
	language: text({ enum: languages }).notNull(),
	status: text({ enum: ["published"] }).notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const outbox = intentionsSchema.table("outbox", {
	id: uuid().primaryKey().defaultRandom(),
	type: text({ enum: intentionEventTypes }).notNull(),
	payload: jsonb().notNull(),
	occurredAt: timestamp("occurred_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	processedAt: timestamp("processed_at", { withTimezone: true }),
});
