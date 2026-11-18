import type { IntentionEvent } from "../../intentions";
import type { Analytics } from "../../platform/analytics-port";
import type { Database } from "../../platform/database";
import type { Result } from "../../platform/result";
import {
	putInCatalog,
	removeFromCatalog,
} from "../adapters/persistence/catalog-store";
import type { Embed, EmbeddingUnavailable } from "./embed";

type KeepCatalogInStep = (
	event: IntentionEvent,
	analytics: Analytics,
) => Promise<Result<void, EmbeddingUnavailable>>;

export const createKeepCatalogInStep =
	({
		database,
		embed,
	}: {
		database: Database;
		embed: Embed;
	}): KeepCatalogInStep =>
	async (event, analytics) => {
		switch (event.type) {
			case "IntentionArchived":
				await removeFromCatalog(database, event.payload.intentionId);
				return { ok: true, value: undefined };
			case "IntentionPublished": {
				const { intentionId, text, language } = event.payload;
				const embedding = await embed(text, analytics);
				if (!embedding.ok) return embedding;
				await putInCatalog(database, {
					intentionId,
					text,
					language,
					embedding: embedding.value,
				});
				return { ok: true, value: undefined };
			}
		}
	};
