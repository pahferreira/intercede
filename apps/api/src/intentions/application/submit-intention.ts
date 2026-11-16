import type { Analytics } from "../../platform/analytics-port";
import type { Database } from "../../platform/database";
import type { Result } from "../../platform/result";
import { createPublishIntention } from "../adapters/persistence/intention-store";
import type { RejectionReason } from "../domain/moderation-verdict";
import type { Moderate, ModerationUnavailable } from "./moderate";

export type SubmitIntentionError =
	| ModerationUnavailable
	| { kind: "rejected"; reasons: RejectionReason[] };

export type SubmitIntention = (
	text: string,
	analytics: Analytics,
) => Promise<Result<void, SubmitIntentionError>>;

export const createSubmitIntention = ({
	database,
	moderate,
}: {
	database: Database;
	moderate: Moderate;
}): SubmitIntention => {
	const publish = createPublishIntention(database);
	return async (text, analytics) => {
		const verdict = await moderate(text, analytics);
		if (!verdict.ok) return verdict;
		if (!verdict.value.publishable) {
			return {
				ok: false,
				error: { kind: "rejected", reasons: verdict.value.reasons },
			};
		}
		await publish({ text, language: verdict.value.language });
		return { ok: true, value: undefined };
	};
};
