import { useLingui } from "@lingui/react/macro";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { StatusMessage } from "./StatusMessage";

const entering = "animate-rise motion-reduce:animate-none";

export function Thread(props: { children: ReactNode }) {
	return (
		<div className="mx-auto flex w-full max-w-column-chat flex-col gap-space-3">
			{props.children}
		</div>
	);
}

type UserPromptProps = { text: string } & (
	| { state?: "sent" | "sending"; onRetry?: never }
	| { state: "failed"; onRetry: () => void }
);

export function UserPrompt(props: UserPromptProps) {
	const { t } = useLingui();

	return (
		<div
			className={clsx(
				"ml-auto flex max-w-4/5 flex-col items-end gap-space-1",
				entering,
			)}
		>
			<p
				className={clsx(
					"max-w-column-form rounded-lg rounded-br-sm bg-ivory px-space-4 py-space-3 text-body whitespace-pre-wrap wrap-anywhere text-on-ivory shadow-sm",
					props.state === "sending" && "opacity-60",
				)}
			>
				{props.text}
			</p>
			{props.state === "sending" && (
				<p className="text-small text-ivory-subtle">{t`Sending…`}</p>
			)}
			{props.state === "failed" && (
				<StatusMessage tone="danger" onRetry={props.onRetry}>
					{t`Not sent.`}
				</StatusMessage>
			)}
		</div>
	);
}

type AssistantReplyProps = {
	paragraphs: readonly string[];
	streaming?: boolean;
};

export function AssistantReply(props: AssistantReplyProps) {
	const last = props.paragraphs.length - 1;

	return (
		<div
			aria-live="polite"
			className={clsx(
				"flex max-w-reply flex-col gap-space-3 text-body-lg text-ivory",
				entering,
			)}
		>
			{props.paragraphs.map((paragraph, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: paragraphs only grow at the end while streaming
				<p key={index}>
					{paragraph}
					{props.streaming && index === last && (
						<span
							aria-hidden
							className="ml-space-1 inline-block h-lh animate-blink border-l-2 border-flame align-bottom motion-reduce:animate-none"
						/>
					)}
				</p>
			))}
		</div>
	);
}

const dotDelays = ["", "animate-delay-160", "animate-delay-320"] as const;

export function SearchingStatus() {
	const { t } = useLingui();

	return (
		<p
			role="status"
			className={clsx(
				"flex items-center gap-space-2 text-body text-ivory-muted",
				entering,
			)}
		>
			<span aria-hidden className="flex gap-space-1">
				{dotDelays.map((delay) => (
					<span
						key={delay}
						className={clsx(
							"size-dot animate-breathe rounded-full bg-flame motion-reduce:animate-none",
							delay,
						)}
					/>
				))}
			</span>
			{t`Looking for intentions…`}
		</p>
	);
}
