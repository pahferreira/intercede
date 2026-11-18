import type { CaptureResult, PostHogConfig } from "posthog-js";

const rejectionReasons = [
	"spam",
	"abuse",
	"personal_data",
	"off_topic",
] as const;

const events = {
	submit_viewed: {},
	submit_skipped: {},
	intention_submitted: {},
	intention_rejected: { reason: rejectionReasons },
	entry_sent: {},
	clarifying_question_shown: {},
	refinement_sent: { n: "count" },
	suggestions_shown: { count: "count", fallback: "flag" },
	commit_clicked: { count: "count" },
	followup_link_copied: {},
	followup_viewed: {},
} as const;

type Events = typeof events;

type EventName = keyof Events;

type PropValue<Kind> = Kind extends "count"
	? number
	: Kind extends "flag"
		? boolean
		: Kind extends readonly (infer Value)[]
			? Value
			: never;

type EventProps<E extends EventName> = {
	[Key in keyof Events[E]]: PropValue<Events[E][Key]>;
};

type PropKind = "count" | "flag" | readonly string[];

type PostHogClient = {
	init: (key: string, config: Partial<PostHogConfig>) => unknown;
	capture: (event: string, properties: Record<string, unknown>) => unknown;
};

const followUpPath = /\/intention\/[^/?#\s"]+/g;

function redactIntentionCodes<T>(value: T): T {
	if (typeof value === "string") {
		return value.replace(followUpPath, "/intention/:code") as T;
	}
	if (Array.isArray(value)) {
		return value.map(redactIntentionCodes) as T;
	}
	if (value && Object.getPrototypeOf(value) === Object.prototype) {
		return Object.fromEntries(
			Object.entries(value).map(([key, nested]) => [
				key,
				redactIntentionCodes(nested),
			]),
		) as T;
	}
	return value;
}

function withoutExceptionMessages(
	result: CaptureResult | null,
): CaptureResult | null {
	if (result?.event !== "$exception") {
		return result;
	}
	const { $exception_message, $exception_list, ...properties } =
		result.properties;
	return {
		...result,
		properties: {
			...properties,
			$exception_list: Array.isArray($exception_list)
				? $exception_list.map((exception) => ({
						...exception,
						value: "[redacted]",
					}))
				: $exception_list,
		},
	};
}

const config: Partial<PostHogConfig> = {
	api_host: "/ingest",
	capture_exceptions: true,
	disable_session_recording: true,
	autocapture: false,
	rageclick: false,
	capture_dead_clicks: false,
	capture_heatmaps: false,
	capture_pageview: "history_change",
	capture_pageleave: true,
	before_send: (result: CaptureResult | null) =>
		redactIntentionCodes(withoutExceptionMessages(result)),
};

const discard: PostHogClient["capture"] = () => {};

let capture = discard;

function isAllowed(kind: PropKind, value: unknown) {
	if (kind === "count") {
		return Number.isInteger(value) && (value as number) >= 0;
	}
	if (kind === "flag") {
		return typeof value === "boolean";
	}
	return kind.some((allowed) => allowed === value);
}

function allowlisted(event: EventName, props: Record<string, unknown>) {
	const kinds: Record<string, PropKind> = events[event];
	return Object.fromEntries(
		Object.entries(kinds)
			.filter(([key, kind]) => isAllowed(kind, props[key]))
			.map(([key]) => [key, props[key]]),
	);
}

export function initAnalytics(key: string | undefined, client: PostHogClient) {
	if (!key) {
		capture = discard;
		return;
	}
	client.init(key, config);
	capture = client.capture.bind(client);
}

export function track<E extends EventName>(event: E, props: EventProps<E>) {
	capture(event, allowlisted(event, props));
}
