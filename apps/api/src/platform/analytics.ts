import { randomUUID } from "node:crypto";
import { type BeforeSendFn, PostHog, type PostHogOptions } from "posthog-node";
import type { Analytics, OpenAnalytics } from "./analytics-port";

const disabledAnalytics: Analytics = {
	captureException: () => {},
	captureLlmGeneration: () => {},
	shutdown: async () => {},
};

type PostHogSettings = {
	key: string | undefined;
	host: string;
	fetch?: PostHogOptions["fetch"];
};

type Env = Record<string, string | undefined>;

export const postHogSettings = (env: Env = process.env): PostHogSettings => ({
	key: env.POSTHOG_KEY,
	host: env.POSTHOG_HOST ?? "https://us.i.posthog.com",
});

export const requirePostHogSettings = (env: Env = process.env) => {
	const settings = postHogSettings(env);
	if (!settings.key) {
		throw new Error("POSTHOG_KEY is not set");
	}
	return settings;
};

const withoutExceptionMessages: BeforeSendFn = (event) => {
	const exceptions = event.properties?.$exception_list;
	if (event.event !== "$exception" || !Array.isArray(exceptions)) {
		return event;
	}
	return {
		...event,
		properties: {
			...event.properties,
			$exception_list: exceptions.map((exception) => ({
				...exception,
				value: "[redacted]",
			})),
		},
	};
};

export const createPostHogAnalytics = ({
	key,
	host,
	fetch,
}: PostHogSettings): OpenAnalytics => {
	if (!key) {
		return () => disabledAnalytics;
	}
	return () => {
		const client = new PostHog(key, {
			host,
			fetch,
			flushAt: 1,
			flushInterval: 0,
			before_send: withoutExceptionMessages,
		});
		return {
			captureException: (error) => client.captureException(error),
			captureLlmGeneration: (generation) =>
				client.capture({
					distinctId: randomUUID(),
					event: "$ai_generation",
					properties: {
						$process_person_profile: false,
						$ai_provider: "bedrock",
						$ai_model: generation.model,
						$ai_input_tokens: generation.inputTokens,
						$ai_output_tokens: generation.outputTokens,
						$ai_latency: generation.latencyMs / 1000,
						$ai_total_cost_usd: generation.costUsd,
					},
				}),
			shutdown: () => client.shutdown(),
		};
	};
};
