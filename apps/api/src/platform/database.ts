import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const localDatabaseUrl =
	"postgres://intercede:intercede@localhost:5432/intercede";

export const createDatabase = (
	url = process.env.DATABASE_URL ?? localDatabaseUrl,
) => {
	const db = drizzle(postgres(url, { max: 1 }));

	return {
		db,
		checkDatabase: async () => {
			await db.execute(sql`select 1`);
		},
	};
};
