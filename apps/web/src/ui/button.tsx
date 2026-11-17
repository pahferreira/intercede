import type { Icon } from "@tabler/icons-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

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

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant: keyof typeof variants;
	size?: keyof typeof sizes;
	block?: boolean;
	icon?: Icon;
} & (
		| { loading?: never; loadingLabel?: never }
		| { loading: boolean; loadingLabel: ReactNode }
	);

export function Button({
	variant,
	size = "md",
	block = false,
	icon: LeadingIcon,
	loading = false,
	loadingLabel,
	disabled,
	type = "button",
	className,
	children,
	onClick,
	...props
}: ButtonProps) {
	const interactive = !disabled && !loading;

	return (
		<button
			{...props}
			type={type}
			disabled={disabled}
			aria-busy={loading || undefined}
			aria-disabled={loading || undefined}
			onClick={(event) => {
				if (loading) {
					event.preventDefault();
					return;
				}
				onClick?.(event);
			}}
			className={[
				"inline-grid items-center justify-items-center rounded-md border-2 text-label whitespace-nowrap select-none transition",
				variants[variant].base,
				sizes[size],
				block && "w-full",
				interactive
					? `cursor-pointer motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 ${variants[variant].interactive}`
					: disabled
						? "cursor-not-allowed opacity-40 shadow-none"
						: "cursor-progress",
				className,
			]
				.filter(Boolean)
				.join(" ")}
		>
			<span
				aria-hidden={loading || undefined}
				className={`${stacked} ${loading ? "invisible" : ""}`}
			>
				{LeadingIcon && <LeadingIcon aria-hidden size={20} />}
				{children}
			</span>
			{loadingLabel !== undefined && (
				<span
					aria-hidden={!loading || undefined}
					className={`${stacked} ${loading ? "" : "invisible"}`}
				>
					<span
						aria-hidden
						className="size-5 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-spin-slow"
					/>
					{loadingLabel}
				</span>
			)}
		</button>
	);
}
