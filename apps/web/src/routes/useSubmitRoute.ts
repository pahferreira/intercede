import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { track } from "../analytics";
import { type PublishedIntention, rememberPublished } from "../follow-ups";
import { rememberSubmitOrSkip, rememberSubmitted } from "../submit-gate";

export function useSubmitRoute() {
	const navigate = useNavigate();
	const viewed = useRef(false);

	useEffect(() => {
		if (viewed.current) return;
		viewed.current = true;
		track("submit_viewed", {});
	}, []);

	const leave = () => {
		rememberSubmitOrSkip();
		return navigate({ to: "/pray" });
	};

	const onPublished = (intention: PublishedIntention) => {
		rememberPublished(intention);
		rememberSubmitted();
		return leave();
	};

	const skip = () => {
		track("submit_skipped", {});
		return leave();
	};

	return { onPublished, skip };
}
