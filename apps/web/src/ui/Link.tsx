import { createLink } from "@tanstack/react-router";
import { clsx } from "clsx";
import type { AnchorHTMLAttributes, Ref } from "react";

function Anchor(
	props: AnchorHTMLAttributes<HTMLAnchorElement> & {
		ref?: Ref<HTMLAnchorElement>;
	},
) {
	return (
		<a
			{...props}
			className={clsx(
				"rounded-sm text-label text-ivory underline decoration-line-strong decoration-2 underline-offset-3 transition-colors hover:decoration-ivory",
				props.className,
			)}
		/>
	);
}

export const Link = createLink(Anchor);
