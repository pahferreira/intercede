import { expect, test } from "bun:test";
import { crc32 } from "node:zlib";
import type {
	Analytics,
	LlmGeneration,
} from "../../../platform/analytics-port";
import type {
	AgentEvent,
	SearchAgentTurn,
} from "../../application/search-agent";
import { createClaudeSearchAgent } from "./claude-search-agent";

const header = (name: string, value: string) => {
	const nameBytes = Buffer.from(name);
	const valueBytes = Buffer.from(value);
	const length = Buffer.alloc(2);
	length.writeUInt16BE(valueBytes.length);
	return Buffer.concat([
		Buffer.from([nameBytes.length]),
		nameBytes,
		Buffer.from([7]),
		length,
		valueBytes,
	]);
};

const eventStreamFrame = (anthropicEvent: unknown) => {
	const headers = Buffer.concat([
		header(":event-type", "chunk"),
		header(":content-type", "application/json"),
		header(":message-type", "event"),
	]);
	const payload = Buffer.from(
		JSON.stringify({
			bytes: Buffer.from(JSON.stringify(anthropicEvent)).toString("base64"),
		}),
	);
	const prelude = Buffer.alloc(8);
	prelude.writeUInt32BE(12 + headers.length + payload.length + 4, 0);
	prelude.writeUInt32BE(headers.length, 4);
	const preludeCrc = Buffer.alloc(4);
	preludeCrc.writeUInt32BE(crc32(prelude));
	const message = Buffer.concat([prelude, preludeCrc, headers, payload]);
	const messageCrc = Buffer.alloc(4);
	messageCrc.writeUInt32BE(crc32(message));
	return Buffer.concat([message, messageCrc]);
};

type ToolUse = { id: string; name: string; inputChunks: string[] };

const claudeStreams = (...toolUses: ToolUse[]) => {
	const events: unknown[] = [
		{
			type: "message_start",
			message: {
				id: "msg_test",
				type: "message",
				role: "assistant",
				model: "claude",
				content: [],
				stop_reason: null,
				stop_sequence: null,
				usage: { input_tokens: 800, output_tokens: 1 },
			},
		},
	];
	toolUses.forEach(({ id, name, inputChunks }, index) => {
		events.push({
			type: "content_block_start",
			index,
			content_block: { type: "tool_use", id, name, input: {} },
		});
		for (const partial_json of inputChunks) {
			events.push({
				type: "content_block_delta",
				index,
				delta: { type: "input_json_delta", partial_json },
			});
		}
		events.push({ type: "content_block_stop", index });
	});
	events.push(
		{
			type: "message_delta",
			delta: { stop_reason: "tool_use", stop_sequence: null },
			usage: { output_tokens: 120 },
		},
		{ type: "message_stop" },
	);
	return () =>
		new Response(Buffer.concat(events.map(eventStreamFrame)), {
			headers: { "content-type": "application/vnd.amazon.eventstream" },
		});
};

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

const agentFor = (bedrock: ReturnType<typeof fakeBedrock>) => {
	return createClaudeSearchAgent({
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

const firstTurn: SearchAgentTurn = {
	entry: "Someone looking for work",
	steps: [],
	mustPresent: false,
};

const collect = async (events: AsyncIterable<AgentEvent>) => {
	const collected: AgentEvent[] = [];
	for await (const event of events) collected.push(event);
	return collected;
};

const brotherJob = "0b6f6f8e-3c0e-4a8e-9a43-3f1c2d4b5a61";

test("a find_intentions call from Claude comes back as a search to run", async () => {
	const bedrock = fakeBedrock(
		claudeStreams({
			id: "toolu_1",
			name: "find_intentions",
			inputChunks: ['{"query": "a new ', 'job"}'],
		}),
	);
	const { analytics } = recordingAnalytics();

	const events = await collect(agentFor(bedrock)(firstTurn, analytics));

	expect(events).toEqual([
		{
			type: "find_intentions",
			calls: [{ id: "toolu_1", query: "a new job" }],
		},
	]);
	expect(bedrock.requests[0]?.url).toBe(
		"https://bedrock-runtime.us-east-1.amazonaws.com/model/global.anthropic.claude-haiku-5-5/invoke-with-response-stream",
	);
	expect(JSON.stringify(bedrock.requests[0]?.body.messages)).toContain(
		"Someone looking for work",
	);
});

test("the note of present_suggestions streams as it arrives, then the Suggestions follow", async () => {
	const bedrock = fakeBedrock(
		claudeStreams({
			id: "toolu_2",
			name: "present_suggestions",
			inputChunks: [
				'{"note": "These are ',
				'about \\"work',
				'\\" and\\nhope", "suggestions": [',
				`{"intentionId": "${brotherJob}", "whyNote": "About work"}]}`,
			],
		}),
	);
	const { analytics } = recordingAnalytics();

	const events = await collect(agentFor(bedrock)(firstTurn, analytics));

	expect(events).toEqual([
		{ type: "note_delta", text: "These are " },
		{ type: "note_delta", text: 'about "work' },
		{ type: "note_delta", text: '" and\nhope' },
		{
			type: "present_suggestions",
			suggestions: [{ intentionId: brotherJob, whyNote: "About work" }],
		},
	]);
});

test("earlier searches are replayed to Claude as tool calls and their results", async () => {
	const bedrock = fakeBedrock(
		claudeStreams({
			id: "toolu_3",
			name: "present_suggestions",
			inputChunks: ['{"note": "", "suggestions": []}'],
		}),
	);
	const { analytics } = recordingAnalytics();

	await collect(
		agentFor(bedrock)(
			{
				entry: "Someone looking for work",
				steps: [
					[
						{
							call: { id: "toolu_1", query: "a new job" },
							outcome: {
								kind: "found",
								intentions: [
									{ intentionId: brotherJob, text: "For my brother's new job" },
								],
							},
						},
						{
							call: { id: "toolu_2", query: "work" },
							outcome: { kind: "limit_reached" },
						},
					],
				],
				mustPresent: true,
			},
			analytics,
		),
	);

	const body = bedrock.requests[0]?.body;
	const messages = body?.messages as { role: string; content: unknown }[];
	expect(messages.map((message) => message.role)).toEqual([
		"user",
		"assistant",
		"user",
	]);
	expect(messages[1]?.content).toEqual([
		{
			type: "tool_use",
			id: "toolu_1",
			name: "find_intentions",
			input: { query: "a new job" },
		},
		{
			type: "tool_use",
			id: "toolu_2",
			name: "find_intentions",
			input: { query: "work" },
		},
	]);
	expect(messages[2]?.content).toEqual([
		{
			type: "tool_result",
			tool_use_id: "toolu_1",
			content: JSON.stringify([
				{ intentionId: brotherJob, text: "For my brother's new job" },
			]),
		},
		{
			type: "tool_result",
			tool_use_id: "toolu_2",
			content: expect.any(String),
			is_error: true,
		},
	]);
	expect(body?.tool_choice).toEqual({
		type: "tool",
		name: "present_suggestions",
	});
});

test("while searches are left Claude must call one of the tools", async () => {
	const bedrock = fakeBedrock(
		claudeStreams({
			id: "toolu_1",
			name: "find_intentions",
			inputChunks: ['{"query": "a new job"}'],
		}),
	);
	const { analytics } = recordingAnalytics();

	await collect(agentFor(bedrock)(firstTurn, analytics));

	expect(bedrock.requests[0]?.body.tool_choice).toEqual({ type: "any" });
});

test("each agent call reports its token counts and cost, never its content", async () => {
	const bedrock = fakeBedrock(
		claudeStreams({
			id: "toolu_1",
			name: "find_intentions",
			inputChunks: ['{"query": "a new job"}'],
		}),
	);
	const { analytics, generations } = recordingAnalytics();

	await collect(agentFor(bedrock)(firstTurn, analytics));

	expect(generations).toEqual([
		{
			model: "global.anthropic.claude-haiku-5-5",
			inputTokens: 800,
			outputTokens: 120,
			latencyMs: expect.any(Number),
			costUsd: expect.closeTo(0.00014, 10),
		},
	]);
});

test("an unreachable Bedrock makes the agent unavailable and is reported", async () => {
	const bedrock = fakeBedrock(() =>
		Response.json({ message: "overloaded" }, { status: 503 }),
	);
	const { analytics, exceptions } = recordingAnalytics();

	const events = await collect(agentFor(bedrock)(firstTurn, analytics));

	expect(events).toEqual([{ type: "unavailable" }]);
	expect(exceptions).toHaveLength(1);
});

test("a tool input outside its schema makes the agent unavailable", async () => {
	const bedrock = fakeBedrock(
		claudeStreams({
			id: "toolu_1",
			name: "find_intentions",
			inputChunks: ['{"words": 3}'],
		}),
	);
	const { analytics } = recordingAnalytics();

	const events = await collect(agentFor(bedrock)(firstTurn, analytics));

	expect(events).toEqual([{ type: "unavailable" }]);
});
