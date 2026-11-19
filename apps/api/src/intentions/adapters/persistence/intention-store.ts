import type { Database } from "../../../platform/database";
import type { Language } from "../../domain/intention";
import type { IntentionEvent } from "../../domain/intention-event";
import { intentions, outbox } from "./schema";

const codeAttempts = 5;

export type PublishIntention = (intention: {
	text: string;
	language: Language;
}) => Promise<{ code: string }>;

const isCodeTaken = (error: unknown) => {
	const cause = error instanceof Error && error.cause ? error.cause : error;
	return (
		typeof cause === "object" &&
		cause !== null &&
		"constraint_name" in cause &&
		cause.constraint_name === "intentions_code_unique"
	);
};

const insertIntention = (
	database: Database,
	{ code, text, language }: Parameters<PublishIntention>[0] & { code: string },
) => {
	return database.transaction(async (tx) => {
		const [published] = await tx
			.insert(intentions)
			.values({ code, text, language, status: "published" })
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
		return { code: published.code };
	});
};

export const createPublishIntention =
	(database: Database, issueCode: () => string): PublishIntention =>
	async (intention) => {
		for (let attempt = 1; ; attempt++) {
			try {
				return await insertIntention(database, {
					...intention,
					code: issueCode(),
				});
			} catch (error) {
				if (attempt >= codeAttempts || !isCodeTaken(error)) throw error;
			}
		}
	};
