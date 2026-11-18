import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { createTestApp } from "../../test/app";
import { testDatabase } from "../../test/database";
import { createPublishIntention } from "./adapters/persistence/intention-store";
import { intentions, outbox } from "./adapters/persistence/schema";
import type { Moderate } from "./application/moderate";
import type { Language } from "./domain/intention";

const publishes =
	(language: Language): Moderate =>
	async () => ({ ok: true, value: { publishable: true, language } });

const submit = (app: ReturnType<typeof createTestApp>, text: string) =>
	app.request("/api/intentions", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ text }),
	});

test("a text the moderation passes is published with its detected language", async () => {
	const app = createTestApp({ moderate: publishes("pt") });

	const response = await submit(app, "  Pela saúde da minha mãe  ");

	expect(response.status).toBe(201);
	expect(await response.json()).toMatchObject({ status: "published" });
	const rows = await testDatabase().select().from(intentions);
	expect(rows).toEqual([
		expect.objectContaining({
			text: "Pela saúde da minha mãe",
			language: "pt",
			status: "published",
		}),
	]);
});

type Published = { status: "published"; followUpToken: string; code: string };

test("publishing answers with an unguessable Follow-up Token and keeps only its hash", async () => {
	const app = createTestApp({ moderate: publishes("en") });

	const first = (await (
		await submit(app, "For my brother's new job")
	).json()) as Published;
	const second = (await (
		await submit(app, "For my sister's surgery")
	).json()) as Published;

	expect(first.followUpToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
	expect(second.followUpToken).not.toBe(first.followUpToken);
	const rows = await testDatabase().select().from(intentions);
	const hashes = rows.map((row) => row.followUpTokenHash);
	expect(hashes).toContain(
		createHash("sha256").update(first.followUpToken).digest("hex"),
	);
	for (const row of rows) {
		expect(JSON.stringify(row)).not.toContain(first.followUpToken);
		expect(first.followUpToken).not.toContain(row.id);
	}
});

test("publishing answers with the shareable Intention Code it stored", async () => {
	const app = createTestApp({ moderate: publishes("en") });

	const published = (await (
		await submit(app, "For my brother's new job")
	).json()) as Published;

	const [intention] = await testDatabase().select().from(intentions);
	expect(published.code).toMatch(/^INT-[0-9A-HJKMNP-TV-Z]{5}$/);
	expect(published.code).toBe(intention?.code ?? "missing");
});

test("an Intention Code already taken is drawn again", async () => {
	const publish = createPublishIntention(testDatabase(), () => "INT-AAAAA");
	await publish({
		text: "For my brother's new job",
		language: "en",
		followUpTokenHash: "first",
	});
	const codes = ["INT-AAAAA", "INT-BBBBB"];
	const publishAgain = createPublishIntention(
		testDatabase(),
		() => codes.shift() ?? "INT-CCCCC",
	);

	const published = await publishAgain({
		text: "For my sister's surgery",
		language: "en",
		followUpTokenHash: "second",
	});

	expect(published.code).toBe("INT-BBBBB");
	const rows = await testDatabase().select().from(intentions);
	expect(rows.map((row) => row.code).sort()).toEqual([
		"INT-AAAAA",
		"INT-BBBBB",
	]);
	expect(await testDatabase().select().from(outbox)).toHaveLength(2);
});

test("publishing writes an IntentionPublished outbox row for the Intention", async () => {
	const app = createTestApp({ moderate: publishes("en") });

	await submit(app, "For my brother's new job");

	const [intention] = await testDatabase().select().from(intentions);
	const events = await testDatabase().select().from(outbox);
	expect(events).toEqual([
		expect.objectContaining({
			type: "IntentionPublished",
			payload: {
				intentionId: intention?.id,
				text: "For my brother's new job",
				language: "en",
				publishedAt: intention?.publishedAt.toISOString(),
			},
			processedAt: null,
		}),
	]);
});

test("the Intention is not kept when its outbox row cannot be written", async () => {
	await testDatabase().execute(sql`drop table intentions.outbox`);
	const app = createTestApp({ moderate: publishes("en") });

	const response = await submit(app, "For my brother's new job");

	expect(response.status).toBe(500);
	expect(await testDatabase().select().from(intentions)).toEqual([]);
});

const nothingPersisted = async () => {
	expect(await testDatabase().select().from(intentions)).toEqual([]);
	expect(await testDatabase().select().from(outbox)).toEqual([]);
};

test("a rejected text is answered with its reasons and never persisted", async () => {
	const app = createTestApp({
		moderate: async () => ({
			ok: true,
			value: { publishable: false, reasons: ["personal_data", "abuse"] },
		}),
	});

	const response = await submit(app, "Pray for John Smith, 555-0100");

	expect(response.status).toBe(422);
	expect(await response.json()).toEqual({
		status: "rejected",
		reasons: ["personal_data", "abuse"],
	});
	await nothingPersisted();
});

test("an unavailable moderation is answered with 503 and nothing is persisted", async () => {
	const app = createTestApp({
		moderate: async () => ({
			ok: false,
			error: { kind: "moderation_unavailable" },
		}),
	});

	const response = await submit(app, "For my brother's new job");

	expect(response.status).toBe(503);
	expect(await response.json()).toEqual({ status: "moderation_unavailable" });
	await nothingPersisted();
});

test.each([
	["shorter than 10 characters once trimmed", `   ${"a".repeat(9)}   `],
	["longer than 1000 characters", "a".repeat(1001)],
])("a text %s is refused before moderation", async (_, text) => {
	const app = createTestApp();

	const response = await submit(app, text);

	expect(response.status).toBe(400);
	await nothingPersisted();
});

test("a first submission issues an anonymous Visitor cookie", async () => {
	const app = createTestApp({ moderate: publishes("en") });

	const response = await submit(app, "For my brother's new job");

	const cookie = response.headers.get("set-cookie") ?? "";
	expect(cookie).toMatch(/^intercede_visitor=[0-9a-f-]{36};/);
	expect(cookie).toContain("HttpOnly");
	expect(cookie).toContain("Secure");
	expect(cookie).toContain("SameSite=Lax");
	expect(cookie).toContain("Path=/");
	expect(cookie).toContain("Max-Age=31536000");
});

test("a returning Visitor keeps its cookie", async () => {
	const app = createTestApp({ moderate: publishes("en") });

	const response = await app.request("/api/intentions", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			cookie: "intercede_visitor=0b6f6f8e-3c0e-4a8e-9a43-3f1c2d4b5a6e",
		},
		body: JSON.stringify({ text: "For my brother's new job" }),
	});

	expect(response.status).toBe(201);
	expect(response.headers.get("set-cookie")).toBeNull();
});

test.each([
	["10", "a".repeat(10)],
	["1000", "a".repeat(1000)],
])("a text of exactly %s characters is accepted", async (_, text) => {
	const app = createTestApp({ moderate: publishes("en") });

	const response = await submit(app, text);

	expect(response.status).toBe(201);
});
