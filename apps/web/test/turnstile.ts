import type { TurnstileApi, TurnstileOptions } from "../src/turnstile";

export class FakeTurnstile implements TurnstileApi {
	passes = true;
	executions = 0;
	private widgets = new Map<string, TurnstileOptions>();

	render(_container: HTMLElement, options: TurnstileOptions) {
		const id = `widget-${this.widgets.size + 1}`;
		this.widgets.set(id, options);
		return id;
	}

	execute(widgetId: string) {
		const widget = this.widgets.get(widgetId);
		if (!widget) throw new Error(`no Turnstile widget ${widgetId}`);
		this.executions++;
		const token = `turnstile-token-${this.executions}`;
		queueMicrotask(() =>
			this.passes ? widget.callback(token) : widget["error-callback"](),
		);
	}

	reset(widgetId: string) {
		if (!this.widgets.has(widgetId)) {
			throw new Error(`no Turnstile widget ${widgetId}`);
		}
	}

	remove(widgetId: string) {
		this.widgets.delete(widgetId);
	}
}

export function installTurnstile() {
	const turnstile = new FakeTurnstile();
	window.turnstile = turnstile;
	return turnstile;
}
