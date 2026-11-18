export type TurnstileOptions = {
	sitekey: string;
	execution: "execute";
	appearance: "interaction-only";
	callback: (token: string) => void;
	"error-callback": () => void;
	"timeout-callback": () => void;
	"unsupported-callback": () => void;
};

export type TurnstileApi = {
	render: (container: HTMLElement, options: TurnstileOptions) => string;
	execute: (widgetId: string) => void;
	reset: (widgetId: string) => void;
	remove: (widgetId: string) => void;
};

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

const scriptUrl =
	"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<TurnstileApi> | undefined;

export function loadTurnstile() {
	if (window.turnstile) return Promise.resolve(window.turnstile);
	loading ??= new Promise<TurnstileApi>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = scriptUrl;
		script.async = true;
		script.onload = () =>
			window.turnstile
				? resolve(window.turnstile)
				: reject(new Error("Turnstile did not load"));
		script.onerror = () => {
			loading = undefined;
			script.remove();
			reject(new Error("Turnstile did not load"));
		};
		document.head.append(script);
	});
	return loading;
}

export type TurnstileWidget = {
	token: () => Promise<string>;
	remove: () => void;
};

export function renderInvisibleWidget(
	api: TurnstileApi,
	container: HTMLElement,
	sitekey: string,
): TurnstileWidget {
	let pending: PromiseWithResolvers<string> | undefined;
	let executed = false;
	const fail = () =>
		pending?.reject(new Error("the Turnstile challenge failed"));
	const widgetId = api.render(container, {
		sitekey,
		execution: "execute",
		appearance: "interaction-only",
		callback: (token) => pending?.resolve(token),
		"error-callback": fail,
		"timeout-callback": fail,
		"unsupported-callback": fail,
	});
	return {
		token: () => {
			pending = Promise.withResolvers<string>();
			if (executed) api.reset(widgetId);
			executed = true;
			api.execute(widgetId);
			return pending.promise;
		},
		remove: () => api.remove(widgetId),
	};
}
