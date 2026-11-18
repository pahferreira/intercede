import { useLingui } from "@lingui/react/macro";
import {
	IconAlertCircle,
	IconAlertTriangle,
	IconCheck,
} from "@tabler/icons-react";
import { clsx } from "clsx";
import type { ReactNode } from "react";

const tones = {
	success: { Icon: IconCheck, className: "text-success" },
	notice: { Icon: IconAlertCircle, className: "text-notice" },
	danger: { Icon: IconAlertTriangle, className: "text-danger" },
} as const;

type StatusMessageProps = {
	tone: keyof typeof tones;
	onRetry?: () => void;
	children: ReactNode;
};

export function StatusMessage(props: StatusMessageProps) {
	const { t } = useLingui();
	const { Icon, className } = tones[props.tone];

	return (
		<p className={clsx("flex items-center gap-space-2 text-small", className)}>
			<Icon aria-hidden className="size-icon shrink-0" />
			{props.children}
			{props.onRetry && (
				<button
					type="button"
					onClick={props.onRetry}
					className="cursor-pointer rounded-sm text-label text-ivory underline decoration-line-strong decoration-2 underline-offset-3 transition-colors hover:decoration-ivory"
				>
					{t`Retry`}
				</button>
			)}
		</p>
	);
}
