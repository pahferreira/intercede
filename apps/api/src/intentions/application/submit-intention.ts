import type { Analytics } from "../../platform/analytics-port";
import type { Database } from "../../platform/database";
import type { ConsumeRateLimit } from "../../platform/rate-limit-port";
import type { Result } from "../../platform/result";
import type { VerifyTurnstile } from "../../platform/turnstile-port";
import { createPublishIntention } from "../adapters/persistence/intention-store";
import type { RejectionReason } from "../domain/moderation-verdict";
import { issueIntentionCode } from "./intention-code";
import type { Moderate, ModerationUnavailable } from "./moderate";

type SubmitIntentionError =
	| ModerationUnavailable
	| { kind: "verification_failed" }
	| { kind: "limit_reached" }
	| { kind: "rejected"; reasons: RejectionReason[] };

type PublishedIntention = { code: string };

type Submission = { text: string; turnstileToken: string; visitorId: string };

export type SubmitIntention = (
	submission: Submission,
	analytics: Analytics,
) => Promise<Result<PublishedIntention, SubmitIntentionError>>;

export const createSubmitIntention = ({
	database,
	moderate,
	verifyTurnstile,
	consumeSubmissionLimit,
}: {
	database: Database;
	moderate: Moderate;
	verifyTurnstile: VerifyTurnstile;
	consumeSubmissionLimit: ConsumeRateLimit;
}): SubmitIntention => {
	const publish = createPublishIntention(database, issueIntentionCode);
	return async ({ text, turnstileToken, visitorId }, analytics) => {
		if (!(await verifyTurnstile(turnstileToken))) {
			return { ok: false, error: { kind: "verification_failed" } };
		}
		if (!(await consumeSubmissionLimit(visitorId))) {
			return { ok: false, error: { kind: "limit_reached" } };
		}
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
