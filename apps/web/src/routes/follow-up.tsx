import { Trans, useLingui } from "@lingui/react/macro";
import { IntentionCard } from "../ui/IntentionCard";
import { Link } from "../ui/Link";
import { StatusMessage } from "../ui/StatusMessage";
import { useFollowUpRoute } from "./useFollowUpRoute";

export function FollowUp() {
	const { t } = useLingui();
	const { intention, notFound, failed, retry } = useFollowUpRoute();

	return (
		<div className="mx-auto flex w-full max-w-column-form flex-col gap-space-5 md:gap-space-6">
			{intention && (
				<>
					<h1 className="font-display text-heading">
						<Trans>Your prayer request</Trans>
					</h1>
					<IntentionCard
						text={intention.text}
						publishedAt={new Date(intention.publishedAt)}
						commitments={intention.commitments}
						archived={intention.status === "archived"}
					/>
				</>
			)}
			{notFound && (
				<h1 className="font-display text-heading">
					<Trans>Link not found</Trans>
				</h1>
			)}
			{failed && (
				<StatusMessage tone="danger" onRetry={retry}>
					{t`Couldn't load this prayer request.`}
				</StatusMessage>
			)}
			<nav>
				<Link to="/pray">
					<Trans>Pray for someone too</Trans>
				</Link>
			</nav>
		</div>
	);
}
