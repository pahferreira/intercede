import postgres from "postgres";

const localDatabaseUrl =
	"postgres://intercede:intercede@localhost:5432/intercede";

type Env = Record<string, string | undefined>;

export const localOrConfiguredDatabaseUrl = (env: Env = process.env) =>
	env.DATABASE_URL ?? localDatabaseUrl;

export const requireDatabaseUrl = (env: Env = process.env) => {
	const url = env.DATABASE_URL;
	if (!url) {
		throw new Error("DATABASE_URL is not set");
	}
	return url;
};

export const createDatabaseProbe = (
	url: string,
	{ connectTimeoutSeconds = 5 } = {},
) => {
	const client = postgres(url, {
		max: 1,
		prepare: false,
		connect_timeout: connectTimeoutSeconds,
	});

	return async () => {
		try {
			await client`select 1`;
			return true;
		} catch {
			return false;
		}
	};
};
