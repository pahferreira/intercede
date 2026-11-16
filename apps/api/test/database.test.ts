import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { prepareTestDatabase, testDatabase } from "./database";

test("tests run against intercede_test, never the dev database", async () => {
	const [row] = await testDatabase().execute<{ name: string }>(
		sql`select current_database() as name`,
	);

	expect(row?.name).toBe("intercede_test");
});

describe("data written by one test is not visible to the next", () => {
	const tableExists = async () => {
		const [row] = await testDatabase().execute<{ found: string | null }>(
			sql`select to_regclass('isolation_probe')::text as found`,
		);
		return row?.found !== null;
	};

	test("a test writes rows, some inside its own transaction", async () => {
		const database = testDatabase();
		await database.execute(sql`create table isolation_probe (id int)`);
		await database.transaction(async (tx) => {
			await tx.execute(sql`insert into isolation_probe values (1)`);
		});

		const rows = await database.execute(sql`select id from isolation_probe`);
		expect(rows.length).toBe(1);
	});

	test("the next test does not see them", async () => {
		expect(await tableExists()).toBe(false);
	});
});

test("preparing the test database fails with the docker instruction when Postgres is unreachable", async () => {
	await expect(
		prepareTestDatabase(
			"postgres://intercede:intercede@127.0.0.1:1/intercede_test",
		),
	).rejects.toThrow("run `docker compose up -d --wait`");
});
