import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";
import {
	type RejectionReason,
	useSubmissionIntention,
} from "../hooks/useSubmissionIntention";
import { useTurnstile } from "../hooks/useTurnstile";
import { Button } from "../ui/Button";
import { Hero } from "../ui/Hero";
import { Textarea } from "../ui/Textarea";
import { useSubmitRoute } from "./useSubmitRoute";

const minLength = 10;
const maxLength = 1000;

export function Submit() {
	const { t } = useLingui();
	const [text, setText] = useState("");
	const { onPublished, skip } = useSubmitRoute();
	const turnstile = useTurnstile();
	const submission = useSubmissionIntention({
		onPublished,
		turnstileToken: turnstile.token,
	});
	const result = submission.data;

	const outsideLimits =
		text.trim().length < minLength || text.length > maxLength;
	const rejectionHints: Record<RejectionReason, string> = {
		personal_data: t`Use initials instead of full names, and leave out contact details.`,
		abuse: t`Keep it respectful: leave out insults and offensive language.`,
		spam: t`Leave out links, ads and repeated text.`,
		off_topic: t`Share something you'd like others to pray for.`,
	};
	const moderationHints =
		result?.status === "rejected"
			? result.reasons.map((reason) => rejectionHints[reason])
			: [];

	return (
		<div className="mx-auto flex w-full max-w-column-form flex-col gap-space-6 md:gap-space-7">
			<Hero />
			<form
				className="flex flex-col gap-space-4"
				onSubmit={(event) => {
					event.preventDefault();
					submission.mutate(text.trim());
				}}
			>
				<h1 className="font-display text-title">
					<Trans>Submit your prayer intention</Trans>
				</h1>
				<Textarea
					label={t`Your prayer intention`}
					value={text}
					onChange={setText}
					minLength={minLength}
					maxLength={maxLength}
					hint={
						moderationHints.length > 0
							? t`Your intention can't be published yet:`
							: t`Between ${minLength} and ${maxLength} characters.`
					}
					moderationHints={moderationHints}
					submitting={submission.isPending}
				/>
				{result?.status === "moderation_unavailable" && (
					<p role="alert" className="text-small text-notice">
						<Trans>
							We couldn't check your intention right now. Please try again in a
							moment.
						</Trans>
					</p>
				)}
				{result?.status === "verification_failed" && (
					<p role="alert" className="text-small text-notice">
						<Trans>Couldn't verify, try again.</Trans>
					</p>
				)}
				{result?.status === "limit_reached" && (
					<p role="alert" className="text-small text-notice">
						<Trans>
							You've reached today's limit for intentions. Come back tomorrow,
							or skip to pray for others.
						</Trans>
					</p>
				)}
				{submission.isError && (
					<p role="alert" className="text-small text-danger">
						<Trans>Something went wrong. Please try again.</Trans>
					</p>
				)}
				<div ref={turnstile.container} />
				<div className="flex justify-end gap-space-3">
					<Button variant="secondary" onClick={skip}>
						<Trans>Skip</Trans>
					</Button>
					<Button
						variant="primary"
						type="submit"
						disabled={outsideLimits}
						loading={submission.isPending}
						loadingLabel={<Trans>Submitting…</Trans>}
					>
						<Trans>Submit</Trans>
					</Button>
				</div>
			</form>
		</div>
	);
}
