import { expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createTestApp } from "../../test/app";
import { testDatabase } from "../../test/database";
import { intentions } from "./adapters/persistence/schema";
import type { IntentionStatus } from "./domain/intention";

const followUp = (code: string) => {
	return createTestApp().request(`/api/intentions/${code}`);
};

const stored = async (code: string, status: IntentionStatus = "published") => {
	const [intention] = await testDatabase()
		.insert(intentions)
		.values({
			code,
			text: "For my brother's new job",
			language: "en",
			status,
			publishedAt: new Date("2026-11-12T14:30:00.000Z"),
		})
		.returning();
	if (!intention) throw new Error("the Intention was not inserted");
	return intention.id;
};

const committed = async (
	intentionId: string,
	visitorId: string,
	committedOn = "2026-11-13",
) => {
	await testDatabase().execute(
		sql`insert into intercession.commitments (visitor_id, intention_id, committed_on) values (${visitorId}, ${intentionId}, ${committedOn})`,
	);
};

test("a published Intention's follow-up shows its text, publication date and Commitment count", async () => {
	await stored("INT-7K3QD");

	const response = await followUp("INT-7K3QD");

	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({
		status: "published",
		text: "For my brother's new job",
		publishedAt: "2026-11-12T14:30:00.000Z",
		commitments: 0,
	});
});

test("the count is of people, so a Visitor who commits on several days counts once", async () => {
	const brotherJob = await stored("INT-7K3QD");
	await committed(brotherJob, "5d0c2a8e-7b1f-4c3e-9a6d-2f4b8c1e0a37");
	await committed(
		brotherJob,
		"5d0c2a8e-7b1f-4c3e-9a6d-2f4b8c1e0a37",
		"2026-11-14",
	);
	await committed(brotherJob, "9e1b7c3d-2a4f-4d6e-8b0c-1f3a5e7d9c24");
	const otherIntention = await stored("INT-2M8XR");
	await committed(otherIntention, "9e1b7c3d-2a4f-4d6e-8b0c-1f3a5e7d9c24");

	const response = await followUp("INT-7K3QD");

	expect(await response.json()).toMatchObject({ commitments: 2 });
});

test("an Archived Intention's follow-up says so and still shows its count", async () => {
	const brotherJob = await stored("INT-7K3QD", "archived");
	await committed(brotherJob, "5d0c2a8e-7b1f-4c3e-9a6d-2f4b8c1e0a37");

	const response = await followUp("INT-7K3QD");

	expect(response.status).toBe(200);
	expect(await response.json()).toMatchObject({
		status: "archived",
		commitments: 1,
	});
});

test.each(["INT-2M8XR", "not-a-code", "%27%3B%20drop%20table"])(
	"the unknown code %s is answered the same, whether missing or invalid",
	async (code) => {
		await stored("INT-7K3QD");

		const response = await followUp(code);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ status: "not_found" });
	},
);
