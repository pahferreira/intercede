import type { Analytics } from "../../platform/analytics-port";
import type { Database } from "../../platform/database";
import type { Result } from "../../platform/result";
import { createPublishIntention } from "../adapters/persistence/intention-store";
import type { RejectionReason } from "../domain/moderation-verdict";
import { issueIntentionCode } from "./intention-code";
import type { Moderate, ModerationUnavailable } from "./moderate";

type SubmitIntentionError =
	| ModerationUnavailable
	| { kind: "rejected"; reasons: RejectionReason[] };

type PublishedIntention = { code: string };

export type SubmitIntention = (
	text: string,
	analytics: Analytics,
) => Promise<Result<PublishedIntention, SubmitIntentionError>>;

export const createSubmitIntention = ({
	database,
	moderate,
}: {
	database: Database;
	moderate: Moderate;
}): SubmitIntention => {
	const publish = createPublishIntention(database, issueIntentionCode);
	return async (text, analytics) => {
		const verdict = await moderate(text, analytics);
		if (!verdict.ok) return verdict;
		if (!verdict.value.publishable) {
			return {
				ok: false,
				error: { kind: "rejected", reasons: verdict.value.reasons },
			};
		}
		const published = await publish({
			text,
			language: verdict.value.language,
		});
		return { ok: true, value: published };
	};
};
