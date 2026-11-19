import { expect, test } from "bun:test";
import type {
	Analytics,
	LlmGeneration,
} from "../../../platform/analytics-port";
import { createAnthropicModerator } from "./anthropic-moderator";

type SentRequest = { url: string; body: Record<string, unknown> };

function fakeBedrock(reply: () => Response) {
	const requests: SentRequest[] = [];
	const fetch = async (input: string | URL | Request, init?: RequestInit) => {
		requests.push({
			url: String(input),
			body: JSON.parse(String(init?.body)),
		});
		return reply();
	};
	return { requests, fetch: fetch as typeof globalThis.fetch };
}

const claudeAnswers = (verdict: unknown) => () => {
	return Response.json({
		id: "msg_test",
		type: "message",
		role: "assistant",
		model: "global.anthropic.claude-haiku-5-5",
		content: [{ type: "text", text: JSON.stringify(verdict) }],
		stop_reason: "end_turn",
		stop_sequence: null,
		usage: { input_tokens: 400, output_tokens: 20 },
	});
};

function recordingAnalytics() {
	const generations: LlmGeneration[] = [];
	const exceptions: unknown[] = [];
	const analytics: Analytics = {
		captureException: (error) => {
			exceptions.push(error);
		},
		captureLlmGeneration: (generation) => {
			generations.push(generation);
		},
		shutdown: async () => {},
	};
	return { analytics, generations, exceptions };
}

const moderatorFor = (bedrock: ReturnType<typeof fakeBedrock>) => {
	return createAnthropicModerator({
		awsRegion: "us-east-1",
		providerChainResolver: async () => async () => {
			return {
				accessKeyId: "AKIATEST",
				secretAccessKey: "secret",
			};
		},
		maxRetries: 0,
		fetch: bedrock.fetch,
	});
};

test("a publishable text comes back with the language Claude detected", async () => {
	const bedrock = fakeBedrock(claudeAnswers({ language: "pt", reasons: [] }));
	const { analytics } = recordingAnalytics();

	const verdict = await moderatorFor(bedrock)(
		"Pela saúde da minha mãe",
		analytics,
	);

	expect(verdict).toEqual({
		ok: true,
		value: { publishable: true, language: "pt" },
	});
	expect(bedrock.requests[0]?.url).toBe(
		"https://bedrock-runtime.us-east-1.amazonaws.com/model/global.anthropic.claude-haiku-5-5/invoke",
	);
	expect(JSON.stringify(bedrock.requests[0]?.body.messages)).toContain(
		"Pela saúde da minha mãe",
	);
});

test("a rejected text comes back with Claude's reasons", async () => {
	const bedrock = fakeBedrock(
		claudeAnswers({ language: "en", reasons: ["personal_data"] }),
	);
	const { analytics } = recordingAnalytics();

	const verdict = await moderatorFor(bedrock)(
		"Pray for John Smith at 12 Elm Street",
		analytics,
	);

	expect(verdict).toEqual({
		ok: true,
		value: { publishable: false, reasons: ["personal_data"] },
	});
});

test("each moderation reports its token counts and cost, never its content", async () => {
	const bedrock = fakeBedrock(claudeAnswers({ language: "en", reasons: [] }));
	const { analytics, generations } = recordingAnalytics();

	await moderatorFor(bedrock)("For my brother's new job", analytics);

	expect(generations).toEqual([
		{
			model: "global.anthropic.claude-haiku-5-5",
			inputTokens: 400,
			outputTokens: 20,
			latencyMs: expect.any(Number),
			costUsd: 0.00005,
		},
	]);
});

test("an unreachable Bedrock makes moderation unavailable and is reported", async () => {
	const bedrock = fakeBedrock(() =>
		Response.json({ message: "overloaded" }, { status: 503 }),
	);
	const { analytics, exceptions } = recordingAnalytics();

	const verdict = await moderatorFor(bedrock)(
		"For my brother's new job",
		analytics,
	);

	expect(verdict).toEqual({
		ok: false,
		error: { kind: "moderation_unavailable" },
	});
	expect(exceptions).toHaveLength(1);
});

test("an answer outside the verdict schema makes moderation unavailable", async () => {
	const bedrock = fakeBedrock(
		claudeAnswers({ language: "fr", reasons: ["unknown"] }),
	);
	const { analytics } = recordingAnalytics();

	const verdict = await moderatorFor(bedrock)(
		"For my brother's new job",
		analytics,
	);

	expect(verdict).toEqual({
		ok: false,
		error: { kind: "moderation_unavailable" },
	});
});
