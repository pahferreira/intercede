import { IconAlertCircle } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useId } from "react";

type TextareaProps = {
	label: string;
	labelStyle?: "label" | "title";
	placeholder?: string;
	value: string;
	onChange: (value: string) => void;
	minLength: number;
	maxLength: number;
	hint?: string;
	moderationHints?: readonly string[];
	submitting?: boolean;
};

export function Textarea({
	label,
	labelStyle = "label",
	placeholder,
	value,
	onChange,
	minLength,
	maxLength,
	hint,
	moderationHints = [],
	submitting = false,
}: TextareaProps) {
	const id = useId();
	const hintId = `${id}-hint`;
	const moderationHintsId = `${id}-moderation-hints`;
	const rejected = moderationHints.length > 0;
	const outsideLimits = value.length < minLength || value.length > maxLength;
	const describedBy = [hint && hintId, rejected && moderationHintsId]
		.filter(Boolean)
		.join(" ");

	return (
		<div className="flex flex-col gap-space-2">
			<label
				htmlFor={id}
				className={labelStyle === "title" ? "text-title" : "text-label"}
			>
				{label}
			</label>
			<textarea
				id={id}
				placeholder={placeholder}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				readOnly={submitting}
				aria-invalid={rejected || undefined}
				aria-describedby={describedBy || undefined}
				className="field-sizing-content min-h-42 resize-y rounded-lg border-2 border-line-strong bg-violet-raised p-space-4 text-body-lg text-ivory outline-none transition duration-fast ease-out placeholder:text-ivory-subtle hover:not-read-only:border-ivory-muted focus:border-ivory focus:ring-4 focus:ring-ivory-tint aria-invalid:border-notice read-only:cursor-progress read-only:opacity-60 motion-reduce:transition-none"
			/>
			<div className="flex justify-between gap-space-4 text-small">
				<span id={hintId} className="text-ivory-subtle">
					{hint}
				</span>
				<span
					className={clsx(
						"shrink-0 tabular-nums",
						outsideLimits ? "text-notice" : "text-ivory-muted",
					)}
				>
					{value.length} / {maxLength}
				</span>
			</div>
			{rejected && (
				<ul
					id={moderationHintsId}
					className="flex flex-col gap-space-2 text-small"
				>
					{moderationHints.map((reason) => (
						<li key={reason} className="flex gap-space-2">
							<IconAlertCircle
								aria-hidden
								className="size-5 shrink-0 text-notice"
							/>
							{reason}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
