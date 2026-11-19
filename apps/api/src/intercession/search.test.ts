import { expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createTestApp } from "../../test/app";
import { testDatabase } from "../../test/database";
import type { Language } from "../intentions";
import { putInCatalog } from "./adapters/persistence/catalog-store";
import { recordCommitments } from "./adapters/persistence/commitment-store";
import { suggestions } from "./adapters/persistence/schema";
import { type Embed, embeddingDimensions } from "./application/embed";
import type {
	AgentEvent,
	SearchAgent,
	SearchAgentTurn,
} from "./application/search-agent";
import type { SearchEvent } from "./domain/search-event";

const queryAxis = 0;

const embeddingAt = (position: number) => {
	return Array.from({ length: embeddingDimensions }, (_, index) =>
		index === position ? 1 : 0,
	);
};

const embedsQuery: Embed = async () => {
	return {
		ok: true,
		value: embeddingAt(queryAxis),
	};
};

let ownAxis = queryAxis;

const embeddingWithSimilarity = (similarity: number) => {
	ownAxis += 1;
	const embedding = embeddingAt(ownAxis).map(
		(value) => value * Math.sqrt(1 - similarity ** 2),
	);
	embedding[queryAxis] = similarity;
	return embedding;
};

const inCatalog = async (
	intentionId: string,
	text: string,
	similarity = 0.9,
	language: Language = "en",
) => {
	await putInCatalog(testDatabase(), {
		intentionId,
		text,
		language,
		embedding: embeddingWithSimilarity(similarity),
	});
};

const brotherJob = "0b6f6f8e-3c0e-4a8e-9a43-3f1c2d4b5a61";

const scripted = (...steps: AgentEvent[][]): SearchAgent => {
	return async function* () {
		const step = steps.shift() ?? [];
		yield* step;
	};
};

const send = (
	app: ReturnType<typeof createTestApp>,
	entry: string,
	headers: Record<string, string> = {},
	clarification?: { question: string; answer: string },
) => {
	return app.request("/api/search", {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify({ entry, clarification }),
	});
};

const eventsOf = async (response: Response): Promise<SearchEvent[]> => {
	return (await response.text())
		.split("\n\n")
		.filter((frame) => frame.trim() !== "")
		.map((frame) => {
			const type = /^event: (.+)$/m.exec(frame)?.[1];
			const data = /^data: (.+)$/m.exec(frame)?.[1];
			return { type, data: JSON.parse(data ?? "null") } as SearchEvent;
		});
};

test("an Entry streams the note and the Suggestions found in the Catalog", async () => {
	await inCatalog(brotherJob, "For my brother's new job");
	const app = createTestApp({
		embed: embedsQuery,
		agent: scripted(
			[
				{
					type: "find_intentions",
					calls: [{ id: "c1", query: "a new job", language: "en" }],
				},
			],
			[
				{ type: "note_delta", text: "These are " },
				{ type: "note_delta", text: "about work." },
				{
					type: "present_suggestions",
					suggestions: [{ intentionId: brotherJob, whyNote: "About work" }],
				},
			],
		),
	});

	const response = await send(app, "Someone looking for work");

	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toContain("text/event-stream");
	expect(await eventsOf(response)).toEqual([
		{ type: "status", data: { status: "searching" } },
		{ type: "note_delta", data: { text: "These are " } },
		{ type: "note_delta", data: { text: "about work." } },
		{
			type: "suggestions",
			data: {
				match: "close",
				suggestions: [
					{
						intentionId: brotherJob,
						text: "For my brother's new job",
						whyNote: "About work",
					},
				],
			},
		},
		{ type: "done", data: {} },
	]);
});

test("an Entry too vague to search gets the agent's Clarifying Question", async () => {
	const app = createTestApp({
		agent: scripted([
			{
				type: "ask_clarifying_question",
				question: "Who would you like to pray for?",
			},
		]),
	});

	const response = await send(app, "pray");

	expect(await eventsOf(response)).toEqual([
		{ type: "status", data: { status: "searching" } },
		{ type: "question", data: { question: "Who would you like to pray for?" } },
		{ type: "done", data: {} },
	]);
});

const clarified = {
	question: "Who would you like to pray for?",
	answer: "My sister, she is sick",
};

test("the answer to the Clarifying Question continues the turn with the Entry", async () => {
	const turns: SearchAgentTurn[] = [];
	const app = createTestApp({
		agent: async function* (turn) {
			turns.push(structuredClone(turn));
			yield { type: "present_suggestions", suggestions: [] };
		},
	});

	const response = await send(app, "pray", {}, clarified);

	expect(await eventsOf(response)).toEqual([
		{ type: "status", data: { status: "searching" } },
		{ type: "suggestions", data: { match: "close", suggestions: [] } },
		{ type: "done", data: {} },
	]);
	expect(turns).toEqual([
		{ entry: "pray", clarification: clarified, steps: [], mustPresent: false },
	]);
});

test("an agent asking a second Clarifying Question ends the stream with an error", async () => {
	const app = createTestApp({
		agent: scripted([
			{ type: "ask_clarifying_question", question: "And who else?" },
		]),
	});

	const response = await send(app, "pray", {}, clarified);

	expect(await eventsOf(response)).toEqual([
		{ type: "status", data: { status: "searching" } },
		{ type: "error", data: { reason: "internal" } },
	]);
});

test.each([
	["an empty answer", { ...clarified, answer: "  " }],
	[
		"an answer longer than 1000 characters",
		{ ...clarified, answer: "a".repeat(1001) },
	],
	["an empty question", { ...clarified, question: "" }],
])(
	"a Clarification with %s is refused before the agent runs",
	async (_, clarification) => {
		const app = createTestApp();

		const response = await send(app, "pray", {}, clarification);

		expect(response.status).toBe(400);
	},
);

const keepsSearching = () => {
	const turns: SearchAgentTurn[] = [];
	const agent: SearchAgent = async function* (turn) {
		turns.push(structuredClone(turn));
		if (turn.mustPresent) {
			yield { type: "present_suggestions", suggestions: [] };
			return;
		}
		yield {
			type: "find_intentions",
			calls: [{ id: `c${turns.length}`, query: "a new job", language: "en" }],
		};
	};
	return { agent, turns };
};

const countingEmbeds = () => {
	const queries: string[] = [];
	const embed: Embed = async (text, analytics) => {
		queries.push(text);
		return embedsQuery(text, analytics);
	};
	return { embed, queries };
};

test("the agent may search the Catalog at most 3 times before it must present", async () => {
	const { agent, turns } = keepsSearching();
	const { embed, queries } = countingEmbeds();
	const app = createTestApp({ embed, agent });

	const events = await eventsOf(await send(app, "Someone looking for work"));

	expect(queries).toHaveLength(3);
	expect(turns.map((turn) => turn.mustPresent)).toEqual([
		false,
		false,
		false,
		true,
	]);
	expect(events.at(-1)).toEqual({ type: "done", data: {} });
});

test("searches asked for past the limit are answered as limit reached, not run", async () => {
	const { agent, turns } = keepsSearching();
	const { embed, queries } = countingEmbeds();
	const app = createTestApp({
		embed,
		agent: async function* (turn, analytics) {
			if (turn.steps.length > 0) {
				yield* agent(turn, analytics);
				return;
			}
			turns.push(structuredClone(turn));
			yield {
				type: "find_intentions",
				calls: ["a", "b", "c", "d"].map((id) => ({
					id,
					query: "a new job",
					language: "en",
				})),
			};
		},
	});

	await eventsOf(await send(app, "Someone looking for work"));

	expect(queries).toHaveLength(3);
	expect(
		turns[1]?.steps[0]?.map((result) => [result.call.id, result.outcome.kind]),
	).toEqual([
		["a", "found"],
		["b", "found"],
		["c", "found"],
		["d", "limit_reached"],
	]);
	expect(turns[1]?.mustPresent).toBe(true);
});

test("an agent that will not present after its last search ends the stream with an error", async () => {
	let turns = 0;
	const app = createTestApp({
		embed: embedsQuery,
		agent: async function* () {
			turns += 1;
			yield {
				type: "find_intentions",
				calls: [{ id: `c${turns}`, query: "a new job", language: "en" }],
			};
		},
	});

	const events = await eventsOf(await send(app, "Someone looking for work"));

	expect(turns).toBe(4);
	expect(events).toEqual([
		{ type: "status", data: { status: "searching" } },
		{ type: "error", data: { reason: "internal" } },
	]);
});

test("an agent that neither searches nor presents ends the stream with an error", async () => {
	const app = createTestApp({
		agent: scripted([{ type: "note_delta", text: "Hmm" }]),
	});

	const events = await eventsOf(await send(app, "Someone looking for work"));

	expect(events.at(-1)).toEqual({
		type: "error",
		data: { reason: "internal" },
	});
});

const recordingTurns = (...steps: AgentEvent[][]) => {
	const turns: SearchAgentTurn[] = [];
	const play = scripted(...steps);
	const agent: SearchAgent = (turn, analytics) => {
		turns.push(structuredClone(turn));
		return play(turn, analytics);
	};
	return { agent, turns };
};

test("find_intentions answers with the nearest Catalog Intentions first", async () => {
	await inCatalog(
		"0b6f6f8e-3c0e-4a8e-9a43-3f1c2d4b5a62",
		"For my sister's exams",
		0.6,
	);
	await inCatalog(brotherJob, "For my brother's new job", 0.9);
	const { agent, turns } = recordingTurns(
		[
			{
				type: "find_intentions",
				calls: [{ id: "c1", query: "a new job", language: "en" }],
			},
		],
		[{ type: "present_suggestions", suggestions: [] }],
	);
	const app = createTestApp({ embed: embedsQuery, agent });

	await eventsOf(await send(app, "Someone looking for work"));

	expect(turns[1]?.steps[0]?.[0]?.outcome).toEqual({
		kind: "found",
		intentions: [
			{ intentionId: brotherJob, text: "For my brother's new job" },
			{
				intentionId: "0b6f6f8e-3c0e-4a8e-9a43-3f1c2d4b5a62",
				text: "For my sister's exams",
			},
		],
	});
});

const foundBy = async (
	app: ReturnType<typeof createTestApp>,
	turns: SearchAgentTurn[],
	headers: Record<string, string> = {},
) => {
	await eventsOf(await send(app, "Someone looking for work", headers));
	const outcome = turns[1]?.steps[0]?.[0]?.outcome;
	return outcome?.kind === "found"
		? outcome.intentions.map((intention) => intention.intentionId)
		: [];
};

const searchesOnce = () => {
	return recordingTurns(
		[
			{
				type: "find_intentions",
				calls: [{ id: "c1", query: "a new job", language: "en" }],
			},
		],
		[{ type: "present_suggestions", suggestions: [] }],
	);
};

const sisterExams = "0b6f6f8e-3c0e-4a8e-9a43-3f1c2d4b5a62";
const friendHealth = "0b6f6f8e-3c0e-4a8e-9a43-3f1c2d4b5a63";

test("find_intentions leaves out Intentions below the minimum similarity", async () => {
	await inCatalog(brotherJob, "For my brother's new job", 0.5);
	await inCatalog(sisterExams, "For my sister's exams", 0.1);
	const { agent, turns } = searchesOnce();
	const app = createTestApp({ embed: embedsQuery, agent });

	expect(await foundBy(app, turns)).toEqual([brotherJob]);
});

test("Intentions already suggested to this Visitor rank below fresh ones of similar fit, but are still found", async () => {
	const visitor = "5a0f8f4c-1d2e-4b3a-8c9d-0e1f2a3b4c5e";
	const otherVisitor = "5a0f8f4c-1d2e-4b3a-8c9d-0e1f2a3b4c5f";
	await inCatalog(brotherJob, "For my brother's new job", 0.95);
	await inCatalog(sisterExams, "For my sister's exams", 0.8);
	await inCatalog(friendHealth, "For my friend's health", 0.7);
	await testDatabase()
		.insert(suggestions)
		.values([
			{ visitorId: visitor, intentionId: brotherJob },
			{ visitorId: visitor, intentionId: sisterExams },
			{ visitorId: otherVisitor, intentionId: friendHealth },
		]);
	const { agent, turns } = searchesOnce();
	const app = createTestApp({ embed: embedsQuery, agent });

	expect(
		await foundBy(app, turns, { cookie: `intercede_visitor=${visitor}` }),
	).toEqual([brotherJob, friendHealth, sisterExams]);
});

const intentionIds = Array.from(
	{ length: 6 },
	(_, index) => `0b6f6f8e-3c0e-4a8e-9a43-3f1c2d4b5a7${index}`,
);

const suggestionIdsOf = (events: SearchEvent[]) => {
	return events.flatMap((event) =>
		event.type === "suggestions"
			? event.data.suggestions.map((suggestion) => suggestion.intentionId)
			: [],
	);
};

test("Suggestions only reference Intentions found in this request, once each, at most 5", async () => {
	for (const [index, id] of intentionIds.entries()) {
		await inCatalog(id, `For intention number ${index}`);
	}
	const hallucinated = "7d1c0b9e-0000-4000-8000-000000000000";
	const presented = [hallucinated, intentionIds[0] ?? "", ...intentionIds];
	const app = createTestApp({
		embed: embedsQuery,
		agent: scripted(
			[
				{
					type: "find_intentions",
					calls: [{ id: "c1", query: "anything", language: "en" }],
				},
			],
			[
				{
					type: "present_suggestions",
					suggestions: presented.map((intentionId) => ({
						intentionId,
						whyNote: "Fits",
					})),
				},
			],
		),
	});

	const events = await eventsOf(await send(app, "Someone looking for work"));

	expect(suggestionIdsOf(events)).toEqual([
		"0b6f6f8e-3c0e-4a8e-9a43-3f1c2d4b5a70",
		"0b6f6f8e-3c0e-4a8e-9a43-3f1c2d4b5a71",
		"0b6f6f8e-3c0e-4a8e-9a43-3f1c2d4b5a72",
		"0b6f6f8e-3c0e-4a8e-9a43-3f1c2d4b5a73",
		"0b6f6f8e-3c0e-4a8e-9a43-3f1c2d4b5a74",
	]);
});

test("an Intention in the Catalog but not returned by find_intentions is never suggested", async () => {
	await inCatalog(brotherJob, "For my brother's new job");
	const app = createTestApp({
		agent: scripted([
			{
				type: "present_suggestions",
				suggestions: [{ intentionId: brotherJob, whyNote: "Fits" }],
			},
		]),
	});

	const events = await eventsOf(await send(app, "Someone looking for work"));

	expect(suggestionIdsOf(events)).toEqual([]);
});

const sisterExamsInPortuguese = "0b6f6f8e-3c0e-4a8e-9a43-3f1c2d4b5a64";

test.each([
	["pt", "Alguém procurando trabalho", sisterExamsInPortuguese],
	["en", "Someone looking for work", brotherJob],
] as const)(
	"an Entry in %s only gets Suggestions in its own Language",
	async (language, entry, expected) => {
		await inCatalog(brotherJob, "For my brother's new job", 0.9, "en");
		await inCatalog(
			sisterExamsInPortuguese,
			"Pela prova da minha irmã",
			0.9,
			"pt",
		);
		const app = createTestApp({
			embed: embedsQuery,
			agent: scripted(
				[
					{
						type: "find_intentions",
						calls: [{ id: "c1", query: entry, language }],
					},
				],
				[
					{
						type: "present_suggestions",
						suggestions: [brotherJob, sisterExamsInPortuguese].map(
							(intentionId) => ({ intentionId, whyNote: "Fits" }),
						),
					},
				],
			),
		});

		const events = await eventsOf(await send(app, entry));

		expect(suggestionIdsOf(events)).toEqual([expected]);
	},
);

const visitor = "5a0f8f4c-1d2e-4b3a-8c9d-0e1f2a3b4c5d";

const committedBy = async (intentionId: string, count: number) => {
	for (let index = 0; index < count; index += 1) {
		await recordCommitments(testDatabase(), {
			visitorId: crypto.randomUUID(),
			intentionIds: [intentionId],
		});
	}
};

const searchesAndPresents = (
	suggested: string[],
	language: Language = "en",
) => {
	return scripted(
		[
			{
				type: "find_intentions",
				calls: [{ id: "c1", query: "anything", language }],
			},
		],
		[
			{ type: "note_delta", text: "Nothing fits closely." },
			{
				type: "present_suggestions",
				suggestions: suggested.map((intentionId) => ({
					intentionId,
					whyNote: "Fits",
				})),
			},
		],
	);
};

test("with no close match, up to 5 Intentions with the fewest Commitments are suggested as a fallback", async () => {
	const commitmentCounts = [3, 0, 2, 1, 4, 5];
	for (const [index, id] of intentionIds.entries()) {
		await inCatalog(id, `For intention number ${index}`, 0.1);
		await committedBy(id, commitmentCounts[index] ?? 0);
	}
	const app = createTestApp({
		embed: embedsQuery,
		agent: searchesAndPresents([]),
	});

	const events = await eventsOf(await send(app, "Someone looking for work"));

	expect(events).toEqual([
		{ type: "status", data: { status: "searching" } },
		{ type: "note_delta", data: { text: "Nothing fits closely." } },
		{
			type: "suggestions",
			data: {
				match: "fallback",
				suggestions: [1, 3, 2, 0, 4].map((index) => ({
					intentionId: intentionIds[index] ?? "",
					text: `For intention number ${index}`,
				})),
			},
		},
		{ type: "done", data: {} },
	]);
});

test("the fallback only suggests Intentions in the Entry's Language", async () => {
	await inCatalog(brotherJob, "For my brother's new job", 0.1, "en");
	await inCatalog(
		sisterExamsInPortuguese,
		"Pela prova da minha irmã",
		0.1,
		"pt",
	);
	const app = createTestApp({
		embed: embedsQuery,
		agent: searchesAndPresents([], "pt"),
	});

	const events = await eventsOf(await send(app, "Alguém procurando trabalho"));

	expect(suggestionIdsOf(events)).toEqual([sisterExamsInPortuguese]);
});

test("a Catalog with no Intentions in the Entry's Language falls back to no Suggestions", async () => {
	await inCatalog(
		sisterExamsInPortuguese,
		"Pela prova da minha irmã",
		0.9,
		"pt",
	);
	const app = createTestApp({
		embed: embedsQuery,
		agent: searchesAndPresents([]),
	});

	const events = await eventsOf(await send(app, "Someone looking for work"));

	expect(events).toContainEqual({
		type: "suggestions",
		data: { match: "empty_catalog", suggestions: [] },
	});
});

test("an agent that presents nothing without searching gets no fallback", async () => {
	await inCatalog(brotherJob, "For my brother's new job");
	const app = createTestApp({
		agent: scripted([{ type: "present_suggestions", suggestions: [] }]),
	});

	const events = await eventsOf(await send(app, "Someone looking for work"));

	expect(events).toContainEqual({
		type: "suggestions",
		data: { match: "close", suggestions: [] },
	});
});

test("an Intention suggested as a fallback can be committed to", async () => {
	await inCatalog(brotherJob, "For my brother's new job", 0.1);
	const cookie = `intercede_visitor=${visitor}`;
	const app = createTestApp({
		embed: embedsQuery,
		agent: searchesAndPresents([]),
	});
	await eventsOf(await send(app, "Someone looking for work", { cookie }));

	const response = await app.request("/api/commitments", {
		method: "POST",
		headers: { "content-type": "application/json", cookie },
		body: JSON.stringify({ intentionIds: [brotherJob] }),
	});

	expect(response.status).toBe(201);
});

test("each Suggestion shown is recorded for the Visitor", async () => {
	await inCatalog(brotherJob, "For my brother's new job");
	const app = createTestApp({
		embed: embedsQuery,
		agent: scripted(
			[
				{
					type: "find_intentions",
					calls: [{ id: "c1", query: "a new job", language: "en" }],
				},
			],
			[
				{
					type: "present_suggestions",
					suggestions: [
						{ intentionId: brotherJob, whyNote: "About work" },
						{
							intentionId: "7d1c0b9e-0000-4000-8000-000000000000",
							whyNote: "Made up",
						},
					],
				},
			],
		),
	});

	await eventsOf(
		await send(app, "Someone looking for work", {
			cookie: `intercede_visitor=${visitor}`,
		}),
	);

	const [{ now } = { now: new Date(0) }] = await testDatabase().execute<{
		now: Date;
	}>(sql`select now() as now`);
	expect(await testDatabase().select().from(suggestions)).toEqual([
		{
			visitorId: visitor,
			intentionId: brotherJob,
			suggestedAt: new Date(now),
		},
	]);
});

test("a first search issues an anonymous Visitor cookie", async () => {
	const app = createTestApp({
		agent: scripted([{ type: "present_suggestions", suggestions: [] }]),
	});

	const response = await send(app, "Someone looking for work");

	expect(response.headers.get("set-cookie") ?? "").toMatch(
		/^intercede_visitor=[0-9a-f-]{36};/,
	);
});

test.each([
	["empty once trimmed", "   "],
	["longer than 1000 characters", "a".repeat(1001)],
])("an Entry %s is refused before the agent runs", async (_, entry) => {
	const app = createTestApp();

	const response = await send(app, entry);

	expect(response.status).toBe(400);
});

test("analytics stay open until the stream has ended", async () => {
	const calls: string[] = [];
	const app = createTestApp({
		openAnalytics: () => ({
			captureException: () => {},
			captureLlmGeneration: () => {
				calls.push("captureLlmGeneration");
			},
			shutdown: async () => {
				calls.push("shutdown");
			},
		}),
		agent: async function* (_, analytics) {
			await Bun.sleep(5);
			analytics.captureLlmGeneration({
				model: "fake",
				inputTokens: 1,
				outputTokens: 1,
				latencyMs: 1,
				costUsd: 0,
			});
			yield { type: "present_suggestions", suggestions: [] };
		},
	});

	await eventsOf(await send(app, "Someone looking for work"));

	expect(calls).toEqual(["captureLlmGeneration", "shutdown"]);
});

test("an unexpected failure mid-stream is reported and ends the stream with an error", async () => {
	await testDatabase().execute(sql`drop table intercession.suggestions`);
	await inCatalog(brotherJob, "For my brother's new job");
	const exceptions: unknown[] = [];
	const app = createTestApp({
		openAnalytics: () => ({
			captureException: (error) => {
				exceptions.push(error);
			},
			captureLlmGeneration: () => {},
			shutdown: async () => {},
		}),
		embed: embedsQuery,
		agent: scripted(
			[
				{
					type: "find_intentions",
					calls: [{ id: "c1", query: "a new job", language: "en" }],
				},
			],
			[
				{
					type: "present_suggestions",
					suggestions: [{ intentionId: brotherJob, whyNote: "About work" }],
				},
			],
		),
	});

	const events = await eventsOf(await send(app, "Someone looking for work"));

	expect(events).toEqual([
		{ type: "status", data: { status: "searching" } },
		{ type: "error", data: { reason: "internal" } },
	]);
	expect(exceptions).toHaveLength(1);
});

test("an unavailable agent ends the stream with an error", async () => {
	const app = createTestApp({ agent: scripted([{ type: "unavailable" }]) });

	const events = await eventsOf(await send(app, "Someone looking for work"));

	expect(events).toEqual([
		{ type: "status", data: { status: "searching" } },
		{ type: "error", data: { reason: "internal" } },
	]);
});

test("an unavailable embedding ends the stream with an error", async () => {
	const app = createTestApp({
		embed: async () => ({
			ok: false,
			error: { kind: "embedding_unavailable" },
		}),
		agent: scripted([
			{
				type: "find_intentions",
				calls: [{ id: "c1", query: "a new job", language: "en" }],
			},
		]),
	});

	const events = await eventsOf(await send(app, "Someone looking for work"));

	expect(events).toEqual([
		{ type: "status", data: { status: "searching" } },
		{ type: "error", data: { reason: "internal" } },
	]);
});
