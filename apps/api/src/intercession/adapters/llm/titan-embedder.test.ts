import { expect, test } from "bun:test";
import { Readable } from "node:stream";
import type {
	Analytics,
	LlmGeneration,
} from "../../../platform/analytics-port";
import { createTitanEmbedder } from "./titan-embedder";

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

const embedding = Array.from({ length: 512 }, (_, index) => index / 512);

const titanAnswers =
	(answer: unknown = { embedding, inputTextTokenCount: 8 }) =>
	(): Reply => ({ status: 200, body: answer });

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

const embedderFor = (bedrock: ReturnType<typeof fakeBedrock>) =>
	createTitanEmbedder({
		region: "us-east-1",
		credentials: { accessKeyId: "AKIATEST", secretAccessKey: "secret" },
		maxAttempts: 1,
		requestHandler: bedrock.requestHandler,
	});

test("a text comes back as Titan's 512-dimension embedding", async () => {
	const bedrock = fakeBedrock(titanAnswers());
	const { analytics } = recordingAnalytics();

	const result = await embedderFor(bedrock)(
		"Pela saúde da minha mãe",
		analytics,
	);

	expect(result).toEqual({ ok: true, value: embedding });
	expect(bedrock.requests[0]?.url).toBe(
		"https://bedrock-runtime.us-east-1.amazonaws.com/model/amazon.titan-embed-text-v2%3A0/invoke",
	);
	expect(bedrock.requests[0]?.body).toEqual({
		inputText: "Pela saúde da minha mãe",
		dimensions: 512,
		normalize: true,
	});
});

test("each embedding reports its token count and cost, never its content", async () => {
	const bedrock = fakeBedrock(titanAnswers());
	const { analytics, generations } = recordingAnalytics();

	await embedderFor(bedrock)("For my brother's new job", analytics);

	expect(generations).toEqual([
		{
			model: "amazon.titan-embed-text-v2:0",
			inputTokens: 8,
			outputTokens: 0,
			latencyMs: expect.any(Number),
			costUsd: expect.closeTo(0.00000016, 12),
		},
	]);
});

test("an unreachable Bedrock makes the embedding unavailable and is reported", async () => {
	const bedrock = fakeBedrock(() => ({
		status: 503,
		body: { message: "overloaded" },
	}));
	const { analytics, exceptions } = recordingAnalytics();

	const result = await embedderFor(bedrock)(
		"For my brother's new job",
		analytics,
	);

	expect(result).toEqual({
		ok: false,
		error: { kind: "embedding_unavailable" },
	});
	expect(exceptions).toHaveLength(1);
});

test("an embedding of the wrong dimension makes the embedding unavailable", async () => {
	const bedrock = fakeBedrock(
		titanAnswers({ embedding: [0.1, 0.2], inputTextTokenCount: 8 }),
	);
	const { analytics } = recordingAnalytics();

	const result = await embedderFor(bedrock)(
		"For my brother's new job",
		analytics,
	);

	expect(result).toEqual({
		ok: false,
		error: { kind: "embedding_unavailable" },
	});
});
