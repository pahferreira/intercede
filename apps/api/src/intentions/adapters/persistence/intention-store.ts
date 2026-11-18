import type { Database } from "../../../platform/database";
import type { Language } from "../../domain/intention";
import type { IntentionEvent } from "../../domain/intention-event";
import { intentions, outbox } from "./schema";

export type PublishIntention = (intention: {
	text: string;
	language: Language;
	followUpTokenHash: string;
}) => Promise<{ id: string }>;

export const createPublishIntention =
	(database: Database): PublishIntention =>
	({ text, language, followUpTokenHash }) =>
		database.transaction(async (tx) => {
			const [published] = await tx
				.insert(intentions)
				.values({ text, language, status: "published", followUpTokenHash })
				.returning();
			if (!published) throw new Error("the Intention was not inserted");
			await tx.insert(outbox).values({
				type: "IntentionPublished",
				payload: {
					intentionId: published.id,
					text: published.text,
					language: published.language,
					publishedAt: published.publishedAt.toISOString(),
				},
			} satisfies IntentionEvent);
			return { id: published.id };
		});
