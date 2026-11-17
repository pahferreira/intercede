import { IconAlertCircle } from "@tabler/icons-react";
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
	hints?: readonly string[];
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
	hints = [],
	submitting = false,
}: TextareaProps) {
	const id = useId();
	const hintId = `${id}-hint`;
	const hintsId = `${id}-hints`;
	const rejected = hints.length > 0;
	const outsideLimits = value.length < minLength || value.length > maxLength;
	const describedBy = [hint && hintId, rejected && hintsId]
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
				className="field-sizing-content min-h-42 resize-y rounded-lg border-2 border-line-strong bg-violet-raised p-space-4 text-body-lg text-ivory outline-none transition duration-fast ease-out placeholder:text-ivory-subtle hover:border-ivory-muted focus:border-ivory focus:ring-4 focus:ring-ivory-tint aria-invalid:border-notice read-only:cursor-progress read-only:opacity-60 motion-reduce:transition-none"
			/>
			<div className="flex justify-between gap-space-4 text-small">
				<span id={hintId} className="text-ivory-subtle">
					{hint}
				</span>
				<span
					className={`shrink-0 tabular-nums ${outsideLimits ? "text-notice" : "text-ivory-muted"}`}
				>
					{value.length} / {maxLength}
				</span>
			</div>
			{rejected && (
				<ul id={hintsId} className="flex flex-col gap-space-2 text-small">
					{hints.map((reason) => (
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
