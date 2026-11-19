import type { TurnstileApi, TurnstileOptions } from "../src/turnstile";

export class FakeTurnstile implements TurnstileApi {
	passes = true;
	ending: "timeout" | "unsupported" | undefined;
	executions = 0;
	private widgets = new Map<string, TurnstileOptions>();
	private containers = new Map<HTMLElement, string>();
	private rendered = 0;

	render(container: HTMLElement, options: TurnstileOptions) {
		const existing = this.containers.get(container);
		if (existing) return existing;
		this.rendered++;
		const id = `widget-${this.rendered}`;
		this.widgets.set(id, options);
		this.containers.set(container, id);
		return id;
	}

	execute(widgetId: string) {
		const widget = this.widgets.get(widgetId);
		if (!widget) throw new Error(`no Turnstile widget ${widgetId}`);
		this.executions++;
		const token = `turnstile-token-${this.executions}`;
		queueMicrotask(() => {
			if (this.ending) return widget[`${this.ending}-callback`]();
			return this.passes ? widget.callback(token) : widget["error-callback"]();
		});
	}

	reset(widgetId: string) {
		if (!this.widgets.has(widgetId)) {
			throw new Error(`no Turnstile widget ${widgetId}`);
		}
	}

	remove(widgetId: string) {
		this.widgets.delete(widgetId);
		for (const [container, id] of this.containers) {
			if (id === widgetId) this.containers.delete(container);
		}
	}
}

export function installTurnstile() {
	const turnstile = new FakeTurnstile();
	window.turnstile = turnstile;
	return turnstile;
}
