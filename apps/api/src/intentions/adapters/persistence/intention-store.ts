import type { Database } from "../../../platform/database";
import type { Language } from "../../domain/intention";
import { intentions, outbox } from "./schema";

export type PublishIntention = (intention: {
	text: string;
	language: Language;
}) => Promise<void>;

export const createPublishIntention =
	(database: Database): PublishIntention =>
	({ text, language }) =>
		database.transaction(async (tx) => {
			const [published] = await tx
				.insert(intentions)
				.values({ text, language, status: "published" })
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
			});
		});
