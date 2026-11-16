import { expect, test } from "bun:test";
import type { PostHogOptions } from "posthog-node";
import {
	createPostHogAnalytics,
	postHogSettings,
	requirePostHogSettings,
} from "./analytics";
import type { LlmGeneration } from "./analytics-port";

type SentEvent = { event: string; properties: Record<string, unknown> };

function fakePostHogServer() {
	const requests: string[] = [];
	const fetch: NonNullable<PostHogOptions["fetch"]> = async (url, { body }) => {
		const bytes = new Uint8Array(await new Response(body).arrayBuffer());
		requests.push(
			typeof body === "string"
				? body
				: new TextDecoder().decode(Bun.gunzipSync(bytes)),
		);
		expect(url).toStartWith("https://posthog.test/");
		return { status: 200, text: async () => "{}", json: async () => ({}) };
	};
	return {
		requests,
		events: () =>
			requests.flatMap(
				(body) => (JSON.parse(body) as { batch: SentEvent[] }).batch,
			),
		fetch,
	};
}

const generation: LlmGeneration = {
	model: "anthropic.claude-haiku",
	inputTokens: 812,
	outputTokens: 64,
	latencyMs: 1250,
	costUsd: 0.0012,
};

const userText = {
	entry: "pray for my sister Maria",
	name: "my neighbour John Smith",
};

test("without a key nothing is sent to PostHog", async () => {
	const server = fakePostHogServer();
	const openAnalytics = createPostHogAnalytics({
		key: undefined,
		host: "https://posthog.test",
		fetch: server.fetch,
	});

	const analytics = openAnalytics();
	analytics.captureLlmGeneration(generation);
	analytics.captureException(new Error("boom"));
	await analytics.shutdown();

	expect(server.requests).toEqual([]);
});

test("an LLM generation is sent as counts and the model only, never content", async () => {
	const server = fakePostHogServer();
	const openAnalytics = createPostHogAnalytics({
		key: "phc_test",
		host: "https://posthog.test",
		fetch: server.fetch,
	});
	const withContent = {
		...generation,
		prompt: "Pray for my sister Maria",
		output: "Here are intentions about family",
	};

	const analytics = openAnalytics();
	analytics.captureLlmGeneration(withContent);
	await analytics.shutdown();

	const [sent] = server.events();
	expect(sent?.event).toBe("$ai_generation");
	expect(
		Object.fromEntries(
			Object.entries(sent?.properties ?? {}).filter(([key]) =>
				key.startsWith("$ai_"),
			),
		),
	).toEqual({
		$ai_provider: "bedrock",
		$ai_model: "anthropic.claude-haiku",
		$ai_input_tokens: 812,
		$ai_output_tokens: 64,
		$ai_latency: 1.25,
		$ai_total_cost_usd: 0.0012,
	});
	expect(server.requests.join()).not.toContain("Maria");
	expect(server.requests.join()).not.toContain("intentions about family");
});

test("an exception is sent to PostHog error tracking", async () => {
	const server = fakePostHogServer();
	const openAnalytics = createPostHogAnalytics({
		key: "phc_test",
		host: "https://posthog.test",
		fetch: server.fetch,
	});

	const analytics = openAnalytics();
	analytics.captureException(new Error("boom"));
	await analytics.shutdown();

	expect(server.events().map(({ event }) => event)).toEqual(["$exception"]);
});

test("an exception is sent with its type and stack but never its message", async () => {
	const server = fakePostHogServer();
	const openAnalytics = createPostHogAnalytics({
		key: "phc_test",
		host: "https://posthog.test",
		fetch: server.fetch,
	});

	const analytics = openAnalytics();
	analytics.captureException(
		new TypeError(`Cannot moderate ${userText.entry}`, {
			cause: new Error(`upstream rejected ${userText.name}`),
		}),
	);
	await analytics.shutdown();

	const [sent] = server.events();
	const exceptions = sent?.properties.$exception_list as {
		type: string;
		stacktrace?: { frames: unknown[] };
	}[];
	expect(exceptions.map(({ type }) => type)).toEqual(["TypeError", "Error"]);
	expect(exceptions[0]?.stacktrace?.frames.length).toBeGreaterThan(0);
	expect(server.requests.join()).not.toContain("Maria");
	expect(server.requests.join()).not.toContain("John Smith");
});

test("PostHog settings default to the US cloud and may have no key", () => {
	expect(postHogSettings({})).toEqual({
		key: undefined,
		host: "https://us.i.posthog.com",
	});
});

test("PostHog settings use POSTHOG_KEY and POSTHOG_HOST when set", () => {
	expect(
		postHogSettings({
			POSTHOG_KEY: "phc_test",
			POSTHOG_HOST: "https://eu.i.posthog.com",
		}),
	).toEqual({ key: "phc_test", host: "https://eu.i.posthog.com" });
});

test("requirePostHogSettings throws when POSTHOG_KEY is unset", () => {
	expect(() => requirePostHogSettings({})).toThrow("POSTHOG_KEY");
});
