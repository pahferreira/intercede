import { expect, test } from "bun:test";
import { Readable } from "node:stream";
import { crc32 } from "node:zlib";
import type {
	Analytics,
	LlmGeneration,
} from "../../../platform/analytics-port";
import type {
	AgentEvent,
	SearchAgentTurn,
} from "../../application/search-agent";
import { createNovaSearchAgent } from "./nova-search-agent";

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

const eventStreamFrame = ([eventType, body]: [string, unknown]) => {
	const headers = Buffer.concat([
		header(":event-type", eventType),
		header(":content-type", "application/json"),
		header(":message-type", "event"),
	]);
	const payload = Buffer.from(JSON.stringify(body));
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
type Reply = { status: number; body: Buffer; contentType: string };

const novaStreams =
	(...toolUses: ToolUse[]) =>
	(): Reply => {
		const events: [string, unknown][] = [
			["messageStart", { role: "assistant" }],
		];
		toolUses.forEach(({ id, name, inputChunks }, contentBlockIndex) => {
			events.push([
				"contentBlockStart",
				{ contentBlockIndex, start: { toolUse: { toolUseId: id, name } } },
			]);
			for (const input of inputChunks) {
				events.push([
					"contentBlockDelta",
					{ contentBlockIndex, delta: { toolUse: { input } } },
				]);
			}
			events.push(["contentBlockStop", { contentBlockIndex }]);
		});
		events.push(
			["messageStop", { stopReason: "tool_use" }],
			[
				"metadata",
				{
					usage: { inputTokens: 800, outputTokens: 120, totalTokens: 920 },
					metrics: { latencyMs: 400 },
				},
			],
		);
		return {
			status: 200,
			body: Buffer.concat(events.map(eventStreamFrame)),
			contentType: "application/vnd.amazon.eventstream",
		};
	};

type SentRequest = { url: string; body: Record<string, unknown> };
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
			const { status, body, contentType } = reply();
			return {
				response: {
					statusCode: status,
					headers: { "content-type": contentType },
					body: Readable.from([body]),
				},
			};
		},
	};
	return { requests, requestHandler };
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

const agentFor = (bedrock: ReturnType<typeof fakeBedrock>) =>
	createNovaSearchAgent({
		region: "us-east-1",
		credentials: { accessKeyId: "AKIATEST", secretAccessKey: "secret" },
		maxAttempts: 1,
		requestHandler: bedrock.requestHandler,
	});

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

test("a find_intentions call from Nova comes back as a search to run", async () => {
	const bedrock = fakeBedrock(
		novaStreams({
			id: "tooluse_1",
			name: "find_intentions",
			inputChunks: ['{"query": "a new ', 'job"}'],
		}),
	);
	const { analytics } = recordingAnalytics();

	const events = await collect(agentFor(bedrock)(firstTurn, analytics));

	expect(events).toEqual([
		{
			type: "find_intentions",
			calls: [{ id: "tooluse_1", query: "a new job" }],
		},
	]);
	expect(bedrock.requests[0]?.url).toBe(
		"https://bedrock-runtime.us-east-1.amazonaws.com/model/amazon.nova-lite-v1%3A0/converse-stream",
	);
	expect(JSON.stringify(bedrock.requests[0]?.body.messages)).toContain(
		"Someone looking for work",
	);
});

test("the note of present_suggestions streams as it arrives, then the Suggestions follow", async () => {
	const bedrock = fakeBedrock(
		novaStreams({
			id: "tooluse_2",
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

test("earlier searches are replayed to Nova as tool calls and their results", async () => {
	const bedrock = fakeBedrock(
		novaStreams({
			id: "tooluse_3",
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
							call: { id: "tooluse_1", query: "a new job" },
							outcome: {
								kind: "found",
								intentions: [
									{ intentionId: brotherJob, text: "For my brother's new job" },
								],
							},
						},
						{
							call: { id: "tooluse_2", query: "work" },
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
			toolUse: {
				toolUseId: "tooluse_1",
				name: "find_intentions",
				input: { query: "a new job" },
			},
		},
		{
			toolUse: {
				toolUseId: "tooluse_2",
				name: "find_intentions",
				input: { query: "work" },
			},
		},
	]);
	expect(messages[2]?.content).toEqual([
		{
			toolResult: {
				toolUseId: "tooluse_1",
				content: [
					{
						text: JSON.stringify([
							{ intentionId: brotherJob, text: "For my brother's new job" },
						]),
					},
				],
			},
		},
		{
			toolResult: {
				toolUseId: "tooluse_2",
				content: [{ text: expect.any(String) }],
				status: "error",
			},
		},
	]);
	expect(body?.toolConfig).toMatchObject({
		toolChoice: { tool: { name: "present_suggestions" } },
	});
});

test("while searches are left Nova must call one of the tools", async () => {
	const bedrock = fakeBedrock(
		novaStreams({
			id: "tooluse_1",
			name: "find_intentions",
			inputChunks: ['{"query": "a new job"}'],
		}),
	);
	const { analytics } = recordingAnalytics();

	await collect(agentFor(bedrock)(firstTurn, analytics));

	expect(bedrock.requests[0]?.body.toolConfig).toMatchObject({
		toolChoice: { any: {} },
	});
});

test("each agent call reports its token counts and cost, never its content", async () => {
	const bedrock = fakeBedrock(
		novaStreams({
			id: "tooluse_1",
			name: "find_intentions",
			inputChunks: ['{"query": "a new job"}'],
		}),
	);
	const { analytics, generations } = recordingAnalytics();

	await collect(agentFor(bedrock)(firstTurn, analytics));

	expect(generations).toEqual([
		{
			model: "amazon.nova-lite-v1:0",
			inputTokens: 800,
			outputTokens: 120,
			latencyMs: expect.any(Number),
			costUsd: expect.closeTo(0.0000768, 10),
		},
	]);
});

test("an unreachable Bedrock makes the agent unavailable and is reported", async () => {
	const bedrock = fakeBedrock(() => ({
		status: 503,
		body: Buffer.from(JSON.stringify({ message: "overloaded" })),
		contentType: "application/json",
	}));
	const { analytics, exceptions } = recordingAnalytics();

	const events = await collect(agentFor(bedrock)(firstTurn, analytics));

	expect(events).toEqual([{ type: "unavailable" }]);
	expect(exceptions).toHaveLength(1);
});

test("a tool input outside its schema makes the agent unavailable", async () => {
	const bedrock = fakeBedrock(
		novaStreams({
			id: "tooluse_1",
			name: "find_intentions",
			inputChunks: ['{"words": 3}'],
		}),
	);
	const { analytics } = recordingAnalytics();

	const events = await collect(agentFor(bedrock)(firstTurn, analytics));

	expect(events).toEqual([{ type: "unavailable" }]);
});
