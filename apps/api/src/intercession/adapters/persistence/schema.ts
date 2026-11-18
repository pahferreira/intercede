import {
	index,
	pgSchema,
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
