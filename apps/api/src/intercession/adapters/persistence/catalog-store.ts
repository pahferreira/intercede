import { and, cosineDistance, eq, exists, sql } from "drizzle-orm";
import type { Language } from "../../../intentions";
import type { Database } from "../../../platform/database";
import { type Candidate, candidatesPerSearch } from "../../domain/ranking";
import { catalog, suggestions } from "./schema";

export const putInCatalog = async (
	database: Database,
	entry: {
		intentionId: string;
		text: string;
		language: Language;
		embedding: number[];
	},
) => {
	const { intentionId, ...rest } = entry;
	await database
		.insert(catalog)
		.values(entry)
		.onConflictDoUpdate({ target: catalog.intentionId, set: rest });
};

export const removeFromCatalog = async (
	database: Database,
	intentionId: string,
) => {
	await database.delete(catalog).where(eq(catalog.intentionId, intentionId));
};

export const findCandidatesInCatalog = (
	database: Database,
	{
		embedding,
		language,
		visitorId,
	}: { embedding: number[]; language: Language; visitorId: string },
): Promise<Candidate[]> => {
	const distance = cosineDistance(catalog.embedding, embedding);
	return database
		.select({
			intentionId: catalog.intentionId,
			text: catalog.text,
			similarity: sql<number>`1 - (${distance})`.mapWith(Number),
			alreadySuggested: exists(
				database
					.select()
					.from(suggestions)
					.where(
						and(
							eq(suggestions.visitorId, visitorId),
							eq(suggestions.intentionId, catalog.intentionId),
						),
					),
			).mapWith(Boolean),
		})
		.from(catalog)
		.where(eq(catalog.language, language))
		.orderBy(distance)
		.limit(candidatesPerSearch);
};
