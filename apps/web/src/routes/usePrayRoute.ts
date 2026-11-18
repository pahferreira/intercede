import { useState } from "react";
import { track } from "../analytics";
import {
	dismissPublishedNotice,
	followUpUrl,
	publishedNotice,
} from "../follow-ups";

export function usePrayRoute() {
	const [notice, setNotice] = useState(publishedNotice);
	const [copied, setCopied] = useState(false);

	const dismiss = () => {
		dismissPublishedNotice();
		setNotice(null);
	};

	const copy = async () => {
		if (!notice) return;
		await navigator.clipboard.writeText(followUpUrl(notice.followUpToken));
		track("followup_link_copied", {});
		setCopied(true);
	};

	return { notice, copied, copy, dismiss };
}
