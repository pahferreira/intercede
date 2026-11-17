import { useLingui } from "@lingui/react/macro";
import { IconAlertCircle, IconArrowUp } from "@tabler/icons-react";
import { clsx } from "clsx";
import { type FormEvent, type KeyboardEvent, useId } from "react";

type MessageBoxProps = {
	value: string;
	onChange: (value: string) => void;
	onSubmit: (text: string) => void;
	placeholder: string;
	disabledReason?: string;
};

export function MessageBox(props: MessageBoxProps) {
	const { t } = useLingui();
	const reasonId = useId();
	const disabled = props.disabledReason !== undefined;
	const canSend = !disabled && props.value.trim() !== "";

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (canSend) {
			props.onSubmit(props.value);
		}
	}

	function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (
			event.key === "Enter" &&
			!event.shiftKey &&
			!event.nativeEvent.isComposing
		) {
			event.preventDefault();
			event.currentTarget.form?.requestSubmit();
		}
	}

	return (
		<div className="mx-auto w-full max-w-column-chat px-space-4 pb-safe-space-4 md:px-0 md:pb-safe-space-5">
			<form
				onSubmit={handleSubmit}
				className={clsx(
					"flex items-end gap-space-2 rounded-lg border-2 border-line-strong bg-violet-raised py-space-2 pr-space-2 pl-space-4 transition motion-reduce:transition-none focus-within:border-ivory focus-within:ring-4 focus-within:ring-ivory-tint",
					disabled ? "opacity-70" : "shadow-md",
				)}
			>
				<textarea
					rows={1}
					aria-label={props.placeholder}
					aria-describedby={disabled ? reasonId : undefined}
					placeholder={props.placeholder}
					value={props.value}
					disabled={disabled}
					onChange={(event) => props.onChange(event.target.value)}
					onKeyDown={handleKeyDown}
					className="field-sizing-content max-h-composer-max min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-space-2 text-body text-ivory placeholder:text-ivory-subtle focus-visible:outline-none disabled:cursor-not-allowed"
				/>
				<button
					type="submit"
					aria-label={t`Send`}
					disabled={!canSend}
					className="grid size-control-md shrink-0 place-items-center rounded-md border-2 border-flame bg-flame text-on-flame transition motion-reduce:transition-none enabled:hover:-translate-y-px enabled:hover:border-flame-hover enabled:hover:bg-flame-hover enabled:active:translate-y-0 enabled:active:border-flame-pressed enabled:active:bg-flame-pressed disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-ivory-subtle"
				>
					<IconArrowUp aria-hidden />
				</button>
			</form>
			{disabled && (
				<p
					id={reasonId}
					className="mt-space-2 flex items-start gap-space-2 text-small text-notice"
				>
					<IconAlertCircle aria-hidden size={20} className="shrink-0" />
					{props.disabledReason}
				</p>
			)}
		</div>
	);
}
