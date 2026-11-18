import type { Analytics } from "../../platform/analytics-port";
import type { Database } from "../../platform/database";
import type { Result } from "../../platform/result";
import { createPublishIntention } from "../adapters/persistence/intention-store";
import type { RejectionReason } from "../domain/moderation-verdict";
import { issueFollowUpToken } from "./follow-up-token";
import type { Moderate, ModerationUnavailable } from "./moderate";

const labelLength = 4;

type SubmitIntentionError =
	| ModerationUnavailable
	| { kind: "rejected"; reasons: RejectionReason[] };

type PublishedIntention = { followUpToken: string; label: string };

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
		const followUpToken = issueFollowUpToken();
		const published = await publish({
			text,
			language: verdict.value.language,
			followUpTokenHash: followUpToken.hash,
		});
		return {
			ok: true,
			value: {
				followUpToken: followUpToken.token,
				label: published.id.slice(0, labelLength),
			},
		};
	};
};
