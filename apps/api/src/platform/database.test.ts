import { expect, test } from "bun:test";
import {
	createDatabase,
	createDatabaseProbe,
	requireDatabaseUrl,
} from "./database";

test("database probe reports unreachable when nothing listens on the port", async () => {
	const isDatabaseReachable = createDatabaseProbe(
		createDatabase("postgres://intercede:intercede@127.0.0.1:1/intercede", {
			connectTimeoutSeconds: 1,
		}),
	);

	expect(await isDatabaseReachable()).toBe(false);
});

test("requireDatabaseUrl throws when DATABASE_URL is unset", () => {
	expect(() => requireDatabaseUrl({})).toThrow("DATABASE_URL");
});

test("requireDatabaseUrl returns DATABASE_URL when set", () => {
	expect(
		requireDatabaseUrl({ DATABASE_URL: "postgres://neon.example/db" }),
	).toBe("postgres://neon.example/db");
});
