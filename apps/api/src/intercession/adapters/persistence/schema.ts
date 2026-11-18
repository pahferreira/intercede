import { pgSchema, text, uuid, vector } from "drizzle-orm/pg-core";
import type { Language } from "../../../intentions";
import { embeddingDimensions } from "../../application/embed";

export const intercessionSchema = pgSchema("intercession");

export const catalog = intercessionSchema.table("catalog", {
	intentionId: uuid("intention_id").primaryKey(),
	text: text().notNull(),
	language: text().$type<Language>().notNull(),
	embedding: vector({ dimensions: embeddingDimensions }).notNull(),
});
