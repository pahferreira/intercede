import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { Database } from "../../../platform/database";
import {
	type Commitment,
	suggestionWindowHours,
} from "../../domain/commitment";
import { catalog, commitments, suggestions } from "./schema";

type Batch = { visitorId: string; intentionIds: string[] };

export const findCommittable = (
	database: Database,
	{ visitorId, intentionIds }: Batch,
): Promise<Commitment[]> =>
	database
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

export const recordCommitments = async (
	database: Database,
	{ visitorId, intentionIds }: Batch,
) => {
	await database
		.insert(commitments)
		.values(intentionIds.map((intentionId) => ({ visitorId, intentionId })))
		.onConflictDoNothing();
};
