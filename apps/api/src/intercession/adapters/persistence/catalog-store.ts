import { and, cosineDistance, count, eq, exists, sql } from "drizzle-orm";
import type { Language } from "../../../intentions";
import type { Database } from "../../../platform/database";
import { type FoundIntention, maxSuggestions } from "../../domain/presentation";
import { type Candidate, candidatesPerSearch } from "../../domain/ranking";
import { catalog, commitments, suggestions } from "./schema";

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

type CandidateSearch = {
	embedding: number[];
	language: Language;
	visitorId: string;
};

export const findCandidatesInCatalog = (
	database: Database,
	{ embedding, language, visitorId }: CandidateSearch,
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

export const findFewestCommittedInCatalog = (
	database: Database,
	language: Language,
): Promise<FoundIntention[]> => {
	return database
		.select({ intentionId: catalog.intentionId, text: catalog.text })
		.from(catalog)
		.leftJoin(commitments, eq(commitments.intentionId, catalog.intentionId))
		.where(eq(catalog.language, language))
		.groupBy(catalog.intentionId)
		.orderBy(count(commitments.intentionId), sql`random()`)
		.limit(maxSuggestions);
};
