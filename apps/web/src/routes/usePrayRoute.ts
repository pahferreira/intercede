import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { track } from "../analytics";
import { dismissPublishedNotice, publishedNotice } from "../follow-ups";

export function usePrayRoute() {
	const router = useRouter();
	const [notice, setNotice] = useState(publishedNotice);
	const [copied, setCopied] = useState(false);

	const dismiss = () => {
		dismissPublishedNotice();
		setNotice(null);
	};

	const copy = async () => {
		if (!notice) return;
		const followUp = router.buildLocation({
			to: "/intention/$code",
			params: { code: notice.code },
		});
		try {
			await navigator.clipboard.writeText(
				new URL(followUp.href, location.origin).href,
			);
		} catch {
			return;
		}
		track("followup_link_copied", {});
		setCopied(true);
	};

	return { notice, copied, copy, dismiss };
}
