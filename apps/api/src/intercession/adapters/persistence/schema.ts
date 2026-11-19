import { sql } from "drizzle-orm";
import {
	date,
	index,
	pgSchema,
	primaryKey,
	text,
	timestamp,
	uuid,
	vector,
} from "drizzle-orm/pg-core";
import type { Language } from "../../../intentions";
import { embeddingDimensions } from "../../application/embed";

export const intercessionSchema = pgSchema("intercession");

export const catalog = intercessionSchema.table("catalog", {
	intentionId: uuid("intention_id").primaryKey(),
	text: text().notNull(),
	language: text().$type<Language>().notNull(),
	embedding: vector({ dimensions: embeddingDimensions }).notNull(),
});

export const suggestions = intercessionSchema.table(
	"suggestions",
	{
		visitorId: uuid("visitor_id").notNull(),
		intentionId: uuid("intention_id").notNull(),
		suggestedAt: timestamp("suggested_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("suggestions_visitor_intention_suggested_at_idx").on(
			table.visitorId,
			table.intentionId,
			table.suggestedAt,
		),
	],
);

export const commitments = intercessionSchema.table(
	"commitments",
	{
		visitorId: uuid("visitor_id").notNull(),
		intentionId: uuid("intention_id").notNull(),
		committedOn: date("committed_on")
			.notNull()
			.default(sql`(now() at time zone 'utc')::date`),
		committedAt: timestamp("committed_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		primaryKey({
			columns: [table.visitorId, table.intentionId, table.committedOn],
		}),
	],
);
