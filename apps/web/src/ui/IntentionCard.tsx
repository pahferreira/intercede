import { Plural, useLingui } from "@lingui/react/macro";

type IntentionCardProps = {
	text: string;
	publishedAt: Date;
	commitments: number;
	archived: boolean;
};

export function IntentionCard(props: IntentionCardProps) {
	const { i18n, t } = useLingui();
	const published = i18n.date(props.publishedAt, { dateStyle: "medium" });

	return (
		<article className="flex flex-col gap-space-2 rounded-lg border-2 border-line bg-violet-raised p-space-4 shadow-sm">
			<p className="text-body-lg">{props.text}</p>
			<p className="flex flex-wrap gap-x-space-3 gap-y-space-1 text-small text-ivory-muted">
				<time
					dateTime={props.publishedAt.toISOString()}
				>{t`Published ${published}`}</time>
				<Plural
					value={props.commitments}
					one={
						<span>
							<strong className="text-ivory"># person</strong> committed to pray
							for this
						</span>
					}
					other={
						<span>
							<strong className="text-ivory"># people</strong> committed to pray
							for this
						</span>
					}
				/>
				{props.archived && (
					<span>{t`This intention is no longer being suggested`}</span>
				)}
			</p>
		</article>
	);
}
