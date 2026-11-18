import { Trans, useLingui } from "@lingui/react/macro";
import { IconCheck, IconCopy, IconX } from "@tabler/icons-react";
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
			className="flex items-center gap-space-3 rounded-lg border-2 border-line bg-violet-raised p-space-3 shadow-sm"
		>
			<IconCheck aria-hidden className="size-icon shrink-0 text-success" />
			<p className="grow text-small">
				<Trans>Published — Intention {code}</Trans>
			</p>
			<Button
				variant="secondary"
				icon={props.copied ? IconCheck : IconCopy}
				onClick={props.onCopy}
			>
				{props.copied ? <Trans>Copied</Trans> : <Trans>Copy</Trans>}
			</Button>
			<button
				type="button"
				aria-label={t`Dismiss`}
				onClick={props.onDismiss}
				className="cursor-pointer rounded-sm text-ivory-muted transition-colors hover:text-ivory"
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
