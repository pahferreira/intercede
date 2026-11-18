import { type RefObject, useEffect, useRef } from "react";
import {
	loadTurnstile,
	renderInvisibleWidget,
	type TurnstileWidget,
} from "../turnstile";

type WidgetRef = RefObject<Promise<TurnstileWidget> | undefined>;

function render(widget: WidgetRef, element: HTMLElement) {
	const rendering = loadTurnstile().then((api) =>
		renderInvisibleWidget(api, element, import.meta.env.TURNSTILE_SITE_KEY),
	);
	widget.current = rendering;
	rendering.catch(() => {
		if (widget.current === rendering) widget.current = undefined;
	});
	return rendering;
}

export function useTurnstile() {
	const container = useRef<HTMLDivElement>(null);
	const widget = useRef<Promise<TurnstileWidget>>(undefined);

	useEffect(() => {
		const element = container.current;
		if (!element) return;
		const rendering = render(widget, element);
		return () => {
			widget.current = undefined;
			rendering.then(
				(rendered) => rendered.remove(),
				() => {},
			);
		};
	}, []);

	const token = async () => {
		const element = container.current;
		if (!element) throw new Error("Turnstile has no container");
		return (await (widget.current ?? render(widget, element))).token();
	};

	return { container, token };
}
