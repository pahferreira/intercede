import type { Icon } from "@tabler/icons-react";
import { clsx } from "clsx";
import type { MouseEventHandler, ReactNode } from "react";

const variants = {
	primary: {
		base: "border-flame bg-flame text-on-flame shadow-sm",
		interactive:
			"hover:border-flame-hover hover:bg-flame-hover hover:shadow-flame active:border-flame-pressed active:bg-flame-pressed active:shadow-sm",
	},
	secondary: {
		base: "border-ivory text-ivory",
		interactive: "hover:bg-ivory-tint active:bg-ivory-tint-strong",
	},
} as const;

const sizes = {
	md: "h-control-md px-space-5",
	lg: "h-control-lg px-space-6",
} as const;

const stacked = "col-start-1 row-start-1 flex items-center gap-space-2";

type ButtonProps = {
	variant: keyof typeof variants;
	size?: keyof typeof sizes;
	block?: boolean;
	icon?: Icon;
	type?: "button" | "submit";
	disabled?: boolean;
	onClick?: MouseEventHandler<HTMLButtonElement>;
	children: ReactNode;
} & (
	| { loading?: never; loadingLabel?: never }
	| { loading: boolean; loadingLabel: ReactNode }
);

export function Button({
	size = "md",
	type = "button",
	...props
}: ButtonProps) {
	const interactive = !props.disabled && !props.loading;

	return (
		<button
			type={type}
			disabled={props.disabled}
			aria-busy={props.loading || undefined}
			aria-disabled={props.loading || undefined}
			onClick={(event) => {
				if (props.loading) {
					event.preventDefault();
					return;
				}
				props.onClick?.(event);
			}}
			className={clsx(
				"inline-grid items-center justify-items-center rounded-md border-2 text-label whitespace-nowrap select-none transition",
				variants[props.variant].base,
				sizes[size],
				props.block && "w-full",
				interactive && [
					"cursor-pointer motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0",
					variants[props.variant].interactive,
				],
				props.disabled && "cursor-not-allowed opacity-40 shadow-none",
				props.loading && !props.disabled && "cursor-progress",
			)}
		>
			<span
				aria-hidden={props.loading || undefined}
				className={clsx(stacked, props.loading && "invisible")}
			>
				{props.icon && <props.icon aria-hidden size={20} />}
				{props.children}
			</span>
			{props.loadingLabel !== undefined && (
				<span
					aria-hidden={!props.loading || undefined}
					className={clsx(stacked, !props.loading && "invisible")}
				>
					<span
						aria-hidden
						className="size-5 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-spin-slow"
					/>
					{props.loadingLabel}
				</span>
			)}
		</button>
	);
}
