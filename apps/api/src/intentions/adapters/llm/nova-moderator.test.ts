import { expect, test } from "bun:test";
import { Readable } from "node:stream";
import type {
	Analytics,
	LlmGeneration,
} from "../../../platform/analytics-port";
import { createNovaModerator } from "./nova-moderator";

type SentRequest = { url: string; body: Record<string, unknown> };
type Reply = { status: number; body: unknown };
type HttpRequest = {
	hostname: string;
	path: string;
	body: string | Uint8Array;
};

function fakeBedrock(reply: () => Reply) {
	const requests: SentRequest[] = [];
	const requestHandler = {
		handle: async (request: HttpRequest) => {
			requests.push({
				url: `https://${request.hostname}${request.path}`,
				body: JSON.parse(
					typeof request.body === "string"
						? request.body
						: new TextDecoder().decode(request.body),
				),
			});
			const { status, body } = reply();
			return {
				response: {
					statusCode: status,
					headers: { "content-type": "application/json" },
					body: Readable.from([Buffer.from(JSON.stringify(body))]),
				},
			};
		},
	};
	return { requests, requestHandler };
}

const novaAnswers = (verdict: unknown) => (): Reply => {
	return {
		status: 200,
		body: {
			output: {
				message: {
					role: "assistant",
					content: [
						{
							toolUse: {
								toolUseId: "tooluse_test",
								name: "record_verdict",
								input: verdict,
							},
						},
					],
				},
			},
			stopReason: "tool_use",
			usage: { inputTokens: 400, outputTokens: 20, totalTokens: 420 },
			metrics: { latencyMs: 300 },
		},
	};
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
	return createNovaModerator({
		region: "us-east-1",
		credentials: { accessKeyId: "AKIATEST", secretAccessKey: "secret" },
		maxAttempts: 1,
		requestHandler: bedrock.requestHandler,
	});
};

test("a publishable text comes back with the language Nova detected", async () => {
	const bedrock = fakeBedrock(novaAnswers({ language: "pt", reasons: [] }));
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
		"https://bedrock-runtime.us-east-1.amazonaws.com/model/amazon.nova-lite-v1%3A0/converse",
	);
	expect(bedrock.requests[0]?.body.toolConfig).toMatchObject({
		toolChoice: { tool: { name: "record_verdict" } },
	});
	expect(JSON.stringify(bedrock.requests[0]?.body.messages)).toContain(
		"Pela saúde da minha mãe",
	);
});

test("a rejected text comes back with Nova's reasons", async () => {
	const bedrock = fakeBedrock(
		novaAnswers({ language: "en", reasons: ["personal_data"] }),
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
	const bedrock = fakeBedrock(novaAnswers({ language: "en", reasons: [] }));
	const { analytics, generations } = recordingAnalytics();

	await moderatorFor(bedrock)("For my brother's new job", analytics);

	expect(generations).toEqual([
		{
			model: "amazon.nova-lite-v1:0",
			inputTokens: 400,
			outputTokens: 20,
			latencyMs: expect.any(Number),
			costUsd: expect.closeTo(0.0000288, 10),
		},
	]);
});

test("an unreachable Bedrock makes moderation unavailable and is reported", async () => {
	const bedrock = fakeBedrock(() => ({
		status: 503,
		body: { message: "overloaded" },
	}));
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
		novaAnswers({ language: "fr", reasons: ["unknown"] }),
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

test("an answer without a verdict makes moderation unavailable", async () => {
	const bedrock = fakeBedrock(() => ({
		status: 200,
		body: {
			output: {
				message: { role: "assistant", content: [{ text: "Looks fine." }] },
			},
			stopReason: "end_turn",
			usage: { inputTokens: 400, outputTokens: 5, totalTokens: 405 },
			metrics: { latencyMs: 300 },
		},
	}));
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
