import type { Language } from "../../intentions";
import type { Analytics } from "../../platform/analytics-port";
import type { Database } from "../../platform/database";
import type { Result } from "../../platform/result";
import { findCandidatesInCatalog } from "../adapters/persistence/catalog-store";
import type { FoundIntention } from "../domain/presentation";
import { rank } from "../domain/ranking";
import type { Embed, EmbeddingUnavailable } from "./embed";

type IntentionSearch = {
	query: string;
	language: Language;
	visitorId: string;
};

export type FindIntentions = (
	search: IntentionSearch,
	analytics: Analytics,
) => Promise<Result<FoundIntention[], EmbeddingUnavailable>>;

type FindIntentionsDeps = { database: Database; embed: Embed };

export const createFindIntentions = ({
	database,
	embed,
}: FindIntentionsDeps): FindIntentions => {
	return async ({ query, language, visitorId }, analytics) => {
		const embedding = await embed(query, analytics);
		if (!embedding.ok) return embedding;
		return {
			ok: true,
			value: rank(
				await findCandidatesInCatalog(database, {
					embedding: embedding.value,
					language,
					visitorId,
				}),
			),
		};
	};
};
