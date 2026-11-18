import { useEffect, useRef } from "react";
import {
	loadTurnstile,
	renderInvisibleWidget,
	type TurnstileWidget,
} from "../turnstile";

export function useTurnstile() {
	const container = useRef<HTMLDivElement>(null);
	const widget = useRef<Promise<TurnstileWidget>>(undefined);

	useEffect(() => {
		const element = container.current;
		if (!element) return;
		const rendering = loadTurnstile().then((api) =>
			renderInvisibleWidget(api, element, import.meta.env.TURNSTILE_SITE_KEY),
		);
		rendering.catch(() => {});
		widget.current = rendering;
		return () => {
			widget.current = undefined;
			rendering.then(
				(rendered) => rendered.remove(),
				() => {},
			);
		};
	}, []);

	const token = async () => {
		if (!widget.current) throw new Error("Turnstile is not rendered");
		return (await widget.current).token();
	};

	return { container, token };
}
