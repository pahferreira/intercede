import { sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import {
	drizzle,
	type PostgresJsQueryResultHKT,
} from "drizzle-orm/postgres-js";
import postgres from "postgres";

const localDatabaseUrl =
	"postgres://intercede:intercede@localhost:5432/intercede";

type Env = Record<string, string | undefined>;

export type Database = PgDatabase<PostgresJsQueryResultHKT>;

export const localOrConfiguredDatabaseUrl = (env: Env = process.env) =>
	env.DATABASE_URL ?? localDatabaseUrl;

export const requireDatabaseUrl = (env: Env = process.env) => {
	const url = env.DATABASE_URL;
	if (!url) {
		throw new Error("DATABASE_URL is not set");
	}
	return url;
};

type DatabaseOptions = {
	connectTimeoutSeconds?: number;
	onnotice?: (notice: postgres.Notice) => void;
};

export const createDatabase = (
	url: string,
	{ connectTimeoutSeconds = 5, onnotice }: DatabaseOptions = {},
) =>
	drizzle({
		client: postgres(url, {
			max: 1,
			prepare: false,
			connect_timeout: connectTimeoutSeconds,
			onnotice,
		}),
	});

export const createDatabaseProbe = (database: Database) => async () => {
	try {
		await database.execute(sql`select 1`);
		return true;
	} catch {
		return false;
	}
};
