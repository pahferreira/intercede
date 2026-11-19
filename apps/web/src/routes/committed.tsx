import { Trans, useLingui } from "@lingui/react/macro";
import { Link } from "../ui/Link";
import { useCommittedRoute } from "./useCommittedRoute";

export function Committed() {
	const { t } = useLingui();
	const { commitments, canAskForPrayer } = useCommittedRoute();

	return (
		<div className="mx-auto flex w-full max-w-column-chat flex-col gap-space-5 md:gap-space-6">
			<h1 className="font-display text-heading">
				<Trans>You committed to pray for these intentions:</Trans>
			</h1>
			<ul
				aria-label={t`Committed intentions`}
				className="flex flex-col gap-space-3"
			>
				{commitments.map((commitment) => (
					<li key={commitment.intentionId}>
						<article className="rounded-lg border-2 border-line bg-violet-raised p-space-4 shadow-sm">
							<p className="text-body-lg whitespace-pre-wrap">
								{commitment.text}
							</p>
						</article>
					</li>
				))}
			</ul>
			<p className="font-display text-title">
				<Trans>Have a good prayer</Trans>
			</p>
			<nav className="flex flex-wrap items-center gap-space-5">
				<Link to="/pray">
					<Trans>New search</Trans>
				</Link>
				{canAskForPrayer && (
					<Link to="/" search={{ ask: true }}>
						<Trans>Ask for prayer</Trans>
					</Link>
				)}
			</nav>
		</div>
	);
}
