import { expect, spyOn, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createTestApp } from "../../test/app";
import { testDatabase } from "../../test/database";
import { createTestSweep } from "../../test/sweep";
import { catalog } from "./adapters/persistence/schema";
import type { Embed } from "./application/embed";

const embeddingOf = (text: string) =>
	Array.from({ length: 512 }, (_, index) => (index === text.length ? 1 : 0));

const embeds: Embed = async (text) => ({ ok: true, value: embeddingOf(text) });

const publish = async (text: string, language: "pt" | "en" = "en") => {
	const app = createTestApp({
		moderate: async () => ({
			ok: true,
			value: { publishable: true, language },
		}),
	});
	const response = await app.request("/api/intentions", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ text }),
	});
	expect(response.status).toBe(201);
};

const quietly = async (run: () => Promise<void>) => {
	const info = spyOn(console, "info").mockImplementation(() => {});
	try {
		await run();
	} finally {
		info.mockRestore();
	}
};

test("a published Intention enters the Catalog with its language and embedding", async () => {
	await publish("Pela saúde da minha mãe", "pt");

	await quietly(createTestSweep({ embed: embeds }));

	expect(await testDatabase().select().from(catalog)).toEqual([
		{
			intentionId: expect.any(String),
			text: "Pela saúde da minha mãe",
			language: "pt",
			embedding: embeddingOf("Pela saúde da minha mãe"),
		},
	]);
});

const publishedIntentionIds = async () =>
	(await testDatabase().select().from(catalog)).map(
		(entry) => entry.intentionId,
	);

const archive = async (intentionId: string) => {
	await testDatabase().execute(
		sql`insert into intentions.outbox (type, payload, occurred_at)
			values ('IntentionArchived', ${JSON.stringify({ intentionId })}::jsonb, now() + interval '90 days')`,
	);
};

test("an archived Intention leaves the Catalog", async () => {
	await publish("For my brother's new job");
	await quietly(createTestSweep({ embed: embeds }));
	const [intentionId] = await publishedIntentionIds();
	if (!intentionId) throw new Error("the Intention did not enter the Catalog");

	await archive(intentionId);
	await quietly(createTestSweep());

	expect(await publishedIntentionIds()).toEqual([]);
});

test("an event dispatched again leaves a single Catalog entry", async () => {
	await publish("For my brother's new job");
	await quietly(createTestSweep({ embed: embeds }));

	await testDatabase().execute(
		sql`update intentions.outbox set processed_at = null`,
	);
	await quietly(createTestSweep({ embed: embeds }));

	expect(await testDatabase().select().from(catalog)).toHaveLength(1);
});

test("a processed event is not dispatched on the next tick", async () => {
	await publish("For my brother's new job");
	await quietly(createTestSweep({ embed: embeds }));

	await quietly(createTestSweep());

	expect(await testDatabase().select().from(catalog)).toHaveLength(1);
});

const embeddingUnavailable: Embed = async () => ({
	ok: false,
	error: { kind: "embedding_unavailable" },
});

test("a failed embedding is retried on the next tick", async () => {
	await publish("For my brother's new job");

	await quietly(createTestSweep({ embed: embeddingUnavailable }));
	expect(await testDatabase().select().from(catalog)).toEqual([]);

	await quietly(createTestSweep({ embed: embeds }));
	expect(await testDatabase().select().from(catalog)).toHaveLength(1);
});

test("an archival waits for its Intention's failed embedding instead of overtaking it", async () => {
	await publish("For my brother's new job");
	await quietly(createTestSweep({ embed: embeddingUnavailable }));
	const [event] = await testDatabase().execute<{ id: string }>(
		sql`select payload->>'intentionId' as id from intentions.outbox`,
	);
	if (!event) throw new Error("the Intention has no outbox row");
	await archive(event.id);

	await quietly(createTestSweep({ embed: embeddingUnavailable }));
	await quietly(createTestSweep({ embed: embeds }));

	expect(await publishedIntentionIds()).toEqual([]);
});

test("one Intention's failed embedding does not hold back the others", async () => {
	await publish("For my brother's new job");
	await publish("For my sister's exams");
	const embedsAllButTheBrother: Embed = async (text, analytics) =>
		text.includes("brother")
			? embeddingUnavailable(text, analytics)
			: embeds(text, analytics);

	await quietly(createTestSweep({ embed: embedsAllButTheBrother }));

	expect(
		(await testDatabase().select().from(catalog)).map((entry) => entry.text),
	).toEqual(["For my sister's exams"]);
});

test("each tick logs how many events it dispatched and how many are left", async () => {
	await publish("For my brother's new job");
	await publish("For my sister's exams");
	const info = spyOn(console, "info").mockImplementation(() => {});

	try {
		await createTestSweep({ embed: embeddingUnavailable })();

		expect(info).toHaveBeenCalledWith(
			"sweeper tick: 0 events dispatched, 2 left for the next tick",
		);
	} finally {
		info.mockRestore();
	}
});
