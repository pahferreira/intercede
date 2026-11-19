import { useLingui } from "@lingui/react/macro";
import { IconCheck } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useId, useLayoutEffect, useRef, useState } from "react";

const clampedLines = 3;

function overflowsClamp(element: HTMLElement) {
	const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
	return element.scrollHeight > Math.ceil(lineHeight * clampedLines);
}

type SuggestionCardProps = {
	text: string;
	whyNote?: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
};

export function SuggestionCard(props: SuggestionCardProps) {
	const { t } = useLingui();
	const textId = useId();
	const textRef = useRef<HTMLParagraphElement>(null);
	const [overflows, setOverflows] = useState(false);
	const [expanded, setExpanded] = useState(false);

	useLayoutEffect(() => {
		const element = textRef.current;
		if (!element) {
			return;
		}
		const measure = () => setOverflows(overflowsClamp(element));
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => {
			observer.disconnect();
		};
	}, []);

	return (
		<article
			className={clsx(
				"flex gap-space-3 rounded-lg border-2 bg-violet-raised p-space-4 shadow-sm transition duration-base ease-out hover:-translate-y-px hover:shadow-md motion-reduce:transition-none",
				props.checked
					? "border-flame bg-linear-to-b from-flame-tint to-flame-tint"
					: "border-line hover:border-line-strong",
			)}
		>
			<label className="relative -m-space-2 flex size-control-md shrink-0 cursor-pointer items-center justify-center">
				<input
					type="checkbox"
					aria-label={t`Commit to pray for this intention`}
					checked={props.checked}
					onChange={(event) => props.onCheckedChange(event.target.checked)}
					className="peer size-space-5 cursor-pointer appearance-none rounded-sm border-2 border-line-strong bg-violet transition-colors duration-fast ease-out checked:border-flame checked:bg-flame hover:border-ivory checked:hover:border-flame"
				/>
				<IconCheck
					aria-hidden
					className="pointer-events-none absolute size-space-4 scale-0 text-on-flame transition-transform duration-fast ease-out peer-checked:scale-100 motion-reduce:transition-none"
				/>
			</label>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: tapping the body is a pointer shortcut; the Show more button is the accessible control */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users expand through the Show more button */}
			<div
				onClick={() => overflows && setExpanded(!expanded)}
				className={clsx(
					"flex min-w-0 flex-1 flex-col gap-space-2",
					overflows && "cursor-pointer",
				)}
			>
				<p
					id={textId}
					ref={textRef}
					className={clsx(
						"overflow-hidden text-body-lg transition-[max-height] [interpolate-size:allow-keywords] duration-slow ease-in-out motion-reduce:transition-none",
						expanded ? "max-h-max" : "max-h-clamp-3",
					)}
				>
					{props.text}
				</p>
				{overflows && (
					<button
						type="button"
						aria-expanded={expanded}
						aria-controls={textId}
						className="cursor-pointer self-start rounded-sm text-label underline decoration-line-strong decoration-2 underline-offset-3 transition-colors duration-base ease-out hover:decoration-ivory"
					>
						{expanded ? t`Show less` : t`Show more`}
					</button>
				)}
				{props.whyNote && (
					<p className="text-small text-ivory-muted">{props.whyNote}</p>
				)}
			</div>
		</article>
	);
}
