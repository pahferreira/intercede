import { createLink } from "@tanstack/react-router";
import type { AnchorHTMLAttributes, Ref } from "react";

function Anchor({
	className,
	...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
	ref?: Ref<HTMLAnchorElement>;
}) {
	return (
		<a
			{...props}
			className={`rounded-sm text-label text-ivory underline decoration-line-strong decoration-2 underline-offset-3 transition-colors hover:decoration-ivory ${className ?? ""}`}
		/>
	);
}

export const Link = createLink(Anchor);
