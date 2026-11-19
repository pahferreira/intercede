import { expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createTestApp } from "../../test/app";
import { testDatabase } from "../../test/database";
import {
	putInCatalog,
	removeFromCatalog,
} from "./adapters/persistence/catalog-store";
import { suggestions } from "./adapters/persistence/schema";
import { recordSuggestions } from "./adapters/persistence/suggestion-store";
import { embeddingDimensions } from "./application/embed";

const visitor = "5d0c2a8e-7b1f-4c3e-9a6d-2f4b8c1e0a37";
const otherVisitor = "9e1b7c3d-2a4f-4d6e-8b0c-1f3a5e7d9c24";
const visitorCookie = (id: string) => `intercede_visitor=${id}`;

const brotherJob = "0b6f6f8e-3c0e-4a8e-9a43-3f1c2d4b5a61";
const motherSurgery = "1c7a8f9e-4d1f-4b9e-8b54-4a2d3e5c6b72";

const inCatalog = async (intentionId: string, text: string) => {
	await putInCatalog(testDatabase(), {
		intentionId,
		text,
		language: "en",
		embedding: Array.from({ length: embeddingDimensions }, (_, index) =>
			index === 0 ? 1 : 0,
		),
	});
};

const suggestedTo = (visitorId: string, ...intentionIds: string[]) =>
	recordSuggestions(testDatabase(), visitorId, intentionIds);

const commit = (intentionIds: string[], visitorId = visitor) =>
	createTestApp().request("/api/commitments", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			cookie: visitorCookie(visitorId),
		},
		body: JSON.stringify({ intentionIds }),
	});

const commitmentRows = () =>
	testDatabase().execute<{ visitor_id: string; intention_id: string }>(
		sql`select visitor_id, intention_id from intercession.commitments order by intention_id`,
	);

test("an Intercessor commits to the Suggestions they selected and gets their full text back", async () => {
	await inCatalog(brotherJob, "For my brother's new job");
	await inCatalog(motherSurgery, "For my mother's surgery on Thursday");
	await suggestedTo(visitor, brotherJob, motherSurgery);

	const response = await commit([brotherJob, motherSurgery]);

	expect(response.status).toBe(201);
	expect(await response.json()).toEqual({
		status: "committed",
		commitments: [
			{ intentionId: brotherJob, text: "For my brother's new job" },
			{
				intentionId: motherSurgery,
				text: "For my mother's surgery on Thursday",
			},
		],
	});
	expect([...(await commitmentRows())]).toEqual([
		{ visitor_id: visitor, intention_id: brotherJob },
		{ visitor_id: visitor, intention_id: motherSurgery },
	]);
});

test("a repeated batch on the same day creates no duplicate Commitments", async () => {
	await inCatalog(brotherJob, "For my brother's new job");
	await suggestedTo(visitor, brotherJob);

	const first = await commit([brotherJob, brotherJob]);
	const repeated = await commit([brotherJob]);

	expect(first.status).toBe(201);
	expect(repeated.status).toBe(201);
	expect(await repeated.json()).toEqual({
		status: "committed",
		commitments: [
			{ intentionId: brotherJob, text: "For my brother's new job" },
		],
	});
	expect([...(await commitmentRows())]).toEqual([
		{ visitor_id: visitor, intention_id: brotherJob },
	]);
});

test("a repeat on a later day is a new Commitment", async () => {
	await inCatalog(brotherJob, "For my brother's new job");
	await suggestedTo(visitor, brotherJob);
	await testDatabase().execute(
		sql`insert into intercession.commitments (visitor_id, intention_id, committed_on) values (${visitor}, ${brotherJob}, (now() at time zone 'utc')::date - 1)`,
	);

	expect((await commit([brotherJob])).status).toBe(201);

	expect(await commitmentRows()).toHaveLength(2);
});

const rejectsTheBatch = async (
	intentionIds: string[],
	notSuggested: string[],
) => {
	const response = await commit(intentionIds);

	expect(response.status).toBe(422);
	expect(await response.json()).toEqual({
		status: "not_suggested",
		intentionIds: notSuggested,
	});
	expect(await commitmentRows()).toHaveLength(0);
};

test("an Intention that was never suggested to this Visitor rejects the whole batch", async () => {
	await inCatalog(brotherJob, "For my brother's new job");
	await inCatalog(motherSurgery, "For my mother's surgery on Thursday");
	await suggestedTo(visitor, brotherJob);
	await suggestedTo(otherVisitor, motherSurgery);

	await rejectsTheBatch([brotherJob, motherSurgery], [motherSurgery]);
});

test("an Intention suggested more than 24 hours ago is rejected", async () => {
	await inCatalog(brotherJob, "For my brother's new job");
	await testDatabase().insert(suggestions).values({
		visitorId: visitor,
		intentionId: brotherJob,
		suggestedAt: sql`now() - interval '25 hours'`,
	});

	await rejectsTheBatch([brotherJob], [brotherJob]);
});

test("an Intention archived after it was suggested is rejected", async () => {
	await inCatalog(brotherJob, "For my brother's new job");
	await suggestedTo(visitor, brotherJob);
	await removeFromCatalog(testDatabase(), brotherJob);

	await rejectsTheBatch([brotherJob], [brotherJob]);
});

test.each([
	["an empty batch", { intentionIds: [] }],
	["an id that is not a uuid", { intentionIds: ["INT-7K3QD"] }],
	[
		"more than 20 Intentions",
		{ intentionIds: Array.from({ length: 21 }, () => brotherJob) },
	],
])("%s is a bad request", async (_, body) => {
	const response = await createTestApp().request("/api/commitments", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});

	expect(response.status).toBe(400);
});

test("a first-time Visitor gets a Visitor cookie and nothing to commit to", async () => {
	await inCatalog(brotherJob, "For my brother's new job");
	await suggestedTo(visitor, brotherJob);

	const response = await createTestApp().request("/api/commitments", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ intentionIds: [brotherJob] }),
	});

	expect(response.status).toBe(422);
	expect(response.headers.get("set-cookie")).toContain("intercede_visitor=");
});
