import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { track } from "../analytics";
import { rememberSubmitOrSkip } from "../submit-gate";

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

	const skip = () => {
		track("submit_skipped", {});
		return leave();
	};

	return { leave, skip };
}
