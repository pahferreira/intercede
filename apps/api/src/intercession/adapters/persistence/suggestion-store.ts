import type { Database } from "../../../platform/database";
import { suggestions } from "./schema";

export const recordSuggestions = async (
	database: Database,
	visitorId: string,
	intentionIds: string[],
) => {
	if (intentionIds.length === 0) return;
	await database
		.insert(suggestions)
		.values(intentionIds.map((intentionId) => ({ visitorId, intentionId })));
};
