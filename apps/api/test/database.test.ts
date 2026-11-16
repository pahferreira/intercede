import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { prepareTestDatabase, testDatabase, testDatabaseUrl } from "./database";
import { unreachableDatabaseUrl } from "./unreachable-database";

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
	await expect(prepareTestDatabase(unreachableDatabaseUrl)).rejects.toThrow(
		"run `docker compose up -d --wait`",
	);
});

test("the test database URL is refused when DATABASE_URL points at a remote host", () => {
	expect(() =>
		testDatabaseUrl({
			DATABASE_URL:
				"postgres://intercede:intercede@db.example.com:5432/intercede",
		}),
	).toThrow("refusing to run tests against db.example.com");
});

test("preparing the test database is refused on a remote host", async () => {
	await expect(
		prepareTestDatabase(
			"postgres://intercede:intercede@db.example.com:5432/intercede_test",
		),
	).rejects.toThrow("refusing to run tests against db.example.com");
});

test("the test database URL is accepted on every local host", () => {
	for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
		expect(
			testDatabaseUrl({
				DATABASE_URL: `postgres://intercede:intercede@${host}:5432/intercede`,
			}),
		).toBe(`postgres://intercede:intercede@${host}:5432/intercede_test`);
	}
});
