import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { Database } from "../../../platform/database";
import type { Commitment, CommitmentBatch } from "../../domain/commitment";
import { suggestionWindowHours } from "../../domain/presentation";
import { catalog, commitments, suggestions } from "./schema";

export const findCommittable = (
	database: Database,
	{ visitorId, intentionIds }: CommitmentBatch,
): Promise<Commitment[]> => {
	return database
		.selectDistinct({ intentionId: catalog.intentionId, text: catalog.text })
		.from(catalog)
		.innerJoin(
			suggestions,
			and(
				eq(suggestions.intentionId, catalog.intentionId),
				eq(suggestions.visitorId, visitorId),
				gt(
					suggestions.suggestedAt,
					sql`now() - make_interval(hours => ${suggestionWindowHours})`,
				),
			),
		)
		.where(inArray(catalog.intentionId, intentionIds));
};

export const recordCommitments = async (
	database: Database,
	{ visitorId, intentionIds }: CommitmentBatch,
) => {
	await database
		.insert(commitments)
		.values(intentionIds.map((intentionId) => ({ visitorId, intentionId })))
		.onConflictDoNothing();
};
