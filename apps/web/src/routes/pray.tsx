import { Trans, useLingui } from "@lingui/react/macro";
import {
	IconCheck,
	IconCircleCheck,
	IconCopy,
	IconX,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { Button } from "../ui/Button";
import { usePrayRoute } from "./usePrayRoute";

type PublishedNoticeProps = {
	code: string;
	copied: boolean;
	onCopy: () => void;
	onDismiss: () => void;
};

function PublishedNotice(props: PublishedNoticeProps) {
	const { t } = useLingui();
	const code = props.code;

	return (
		<section
			aria-label={t`Published`}
			className="grid grid-cols-[auto_1fr_auto] items-start gap-x-space-3 gap-y-space-3 rounded-lg border-2 border-line bg-violet-raised p-space-4 shadow-sm md:grid-cols-[auto_1fr_auto_auto] md:items-center md:gap-x-space-4 md:gap-y-space-1"
		>
			<IconCircleCheck
				aria-hidden
				className="size-icon text-success md:row-span-2"
			/>
			<div className="flex flex-col gap-space-1 md:flex-row md:items-baseline md:gap-space-4">
				<p className="flex items-center gap-space-1 text-label text-success">
					<Trans>Published</Trans>
					<IconCheck aria-hidden className="size-icon" />
				</p>
				<p className="text-caption text-ivory-subtle uppercase">
					<Trans>Intention {code}</Trans>
				</p>
			</div>
			<p className="col-span-3 text-small text-ivory-muted md:col-span-1 md:col-start-2 md:row-start-2">
				<Trans>
					Keep this link to see how many people commit to pray for it.
				</Trans>
			</p>
			<div className="col-span-3 md:col-span-1 md:col-start-3 md:row-span-2 md:row-start-1">
				<Button
					variant="secondary"
					icon={props.copied ? IconCheck : IconCopy}
					onClick={props.onCopy}
				>
					{props.copied ? <Trans>Copied</Trans> : <Trans>Copy link</Trans>}
				</Button>
			</div>
			<button
				type="button"
				aria-label={t`Dismiss`}
				onClick={props.onDismiss}
				className="col-start-3 row-start-1 cursor-pointer rounded-sm text-ivory-muted transition-colors hover:text-ivory md:col-start-4 md:row-span-2"
			>
				<IconX aria-hidden className="size-icon" />
			</button>
		</section>
	);
}

export function Pray() {
	const { notice, copied, copy, dismiss } = usePrayRoute();

	return (
		<>
			{notice && (
				<PublishedNotice
					code={notice.code}
					copied={copied}
					onCopy={copy}
					onDismiss={dismiss}
				/>
			)}
			<h1>
				<Trans>Pray</Trans>
			</h1>
			<Link to="/" search={{ ask: true }}>
				<Trans>Ask for prayer</Trans>
			</Link>
		</>
	);
}
