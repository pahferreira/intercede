import { Trans, useLingui } from "@lingui/react/macro";
import {
	IconCheck,
	IconCircleCheck,
	IconCopy,
	IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "../ui/Button";
import { Hero } from "../ui/Hero";
import { Link } from "../ui/Link";
import {
	AssistantReply,
	EntryBubble,
	SearchingStatus,
	Thread,
} from "../ui/Message";
import { MessageBox } from "../ui/MessageBox";
import { StatusMessage } from "../ui/StatusMessage";
import { SuggestionCard } from "../ui/SuggestionCard";
import { Textarea } from "../ui/Textarea";
import { type Exchange, useChat } from "./useChat";
import type { CommitControls } from "./useCommit";
import { usePrayRoute } from "./usePrayRoute";

const minLength = 1;
const maxLength = 1000;

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

type EntryFormProps = {
	onSend: (entry: string) => void;
};

function EntryForm(props: EntryFormProps) {
	const { t } = useLingui();
	const [text, setText] = useState("");
	const entry = text.trim();

	return (
		<form
			className="flex flex-col gap-space-4"
			onSubmit={(event) => {
				event.preventDefault();
				props.onSend(entry);
			}}
		>
			<Textarea
				label={t`What would you like to pray for today?`}
				labelStyle="title"
				value={text}
				onChange={setText}
				minLength={minLength}
				maxLength={maxLength}
			/>
			<div className="flex items-center justify-between gap-space-3">
				<Link to="/" search={{ ask: true }}>
					<Trans>Ask for prayer</Trans>
				</Link>
				<Button
					variant="primary"
					type="submit"
					disabled={entry.length < minLength || text.length > maxLength}
				>
					<Trans>Start</Trans>
				</Button>
			</div>
		</form>
	);
}

type ChatProps = {
	exchange: Exchange;
	selected: ReadonlySet<string>;
	awaitingAnswer: boolean;
	onToggle: (intentionId: string, checked: boolean) => void;
	commit: CommitControls;
	onAnswer: (answer: string) => void;
};

const asParagraphs = (text: string) => text.split(/\n{2,}/).filter(Boolean);

function Chat(props: ChatProps) {
	const { t } = useLingui();
	const [reply, setReply] = useState("");
	const exchange = props.exchange;
	const paragraphs = asParagraphs(exchange.note);

	return (
		<div className="flex flex-col gap-space-5">
			<Thread>
				<EntryBubble text={exchange.entry} />
				{exchange.clarification && (
					<AssistantReply
						paragraphs={asParagraphs(exchange.clarification.question)}
					/>
				)}
				{exchange.clarification?.answer !== undefined && (
					<EntryBubble text={exchange.clarification.answer} />
				)}
				{exchange.status === "searching" && <SearchingStatus />}
				{paragraphs.length > 0 && (
					<AssistantReply
						paragraphs={paragraphs}
						streaming={exchange.status === "answering"}
					/>
				)}
				{exchange.match === "fallback" && (
					<AssistantReply
						paragraphs={[
							t`I couldn't find a close match. These are still waiting for prayer:`,
						]}
					/>
				)}
				{exchange.match === "empty_catalog" && (
					<p className="max-w-reply text-body-lg text-ivory">
						<Trans>No intentions yet.</Trans>{" "}
						<Link to="/" search={{ ask: true }}>
							<Trans>Be the first to ask for prayer</Trans>
						</Link>
					</p>
				)}
				{exchange.suggestions.length > 0 && (
					<ul aria-label={t`Suggestions`} className="flex flex-col gap-space-3">
						{exchange.suggestions.map((suggestion) => (
							<li key={suggestion.intentionId}>
								<SuggestionCard
									text={suggestion.text}
									whyNote={suggestion.whyNote}
									checked={props.selected.has(suggestion.intentionId)}
									onCheckedChange={(checked) =>
										props.onToggle(suggestion.intentionId, checked)
									}
								/>
							</li>
						))}
					</ul>
				)}
				{exchange.status === "failed" && (
					<StatusMessage tone="danger">
						<Trans>Something went wrong. Please try again.</Trans>
					</StatusMessage>
				)}
				{props.commit.unavailable && (
					<StatusMessage tone="notice">
						<Trans>
							Some of the intentions you chose are no longer available.
						</Trans>
					</StatusMessage>
				)}
				{props.selected.size > 0 && (
					<div className="sticky bottom-space-4 flex flex-col items-center gap-space-2 pt-space-3">
						{props.commit.failed && (
							<StatusMessage tone="danger" onRetry={props.commit.retry}>
								<Trans>Couldn't save your commitment.</Trans>
							</StatusMessage>
						)}
						<Button
							variant="primary"
							size="lg"
							loading={props.commit.pending}
							loadingLabel={<Trans>Committing…</Trans>}
							onClick={props.commit.commit}
						>
							<Trans>I commit!</Trans>
						</Button>
					</div>
				)}
			</Thread>
			{props.awaitingAnswer && (
				<div className="sticky bottom-0 -mx-space-4 bg-violet md:mx-0">
					<MessageBox
						value={reply}
						onChange={setReply}
						onSubmit={(text) => {
							setReply("");
							props.onAnswer(text);
						}}
						placeholder={t`Tell me more…`}
					/>
				</div>
			)}
		</div>
	);
}

export function Pray() {
	const { notice, copied, copy, dismiss } = usePrayRoute();
	const chat = useChat();
	const exchange = chat.exchange;

	if (exchange) {
		return (
			<Chat
				exchange={exchange}
				selected={chat.selected}
				awaitingAnswer={chat.awaitingAnswer}
				onToggle={chat.toggle}
				commit={chat.commit}
				onAnswer={chat.answer}
			/>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-column-form flex-col gap-space-6 md:gap-space-7">
			{notice && (
				<PublishedNotice
					code={notice.code}
					copied={copied}
					onCopy={copy}
					onDismiss={dismiss}
				/>
			)}
			<Hero />
			<EntryForm onSend={chat.send} />
		</div>
	);
}
