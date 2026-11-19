import { createDatabase } from "../src/platform/database";

export const unreachableDatabaseUrl =
	"postgres://intercede:intercede@127.0.0.1:1/intercede";

export const unreachableDatabase = () => {
	return createDatabase(unreachableDatabaseUrl, { connectTimeoutSeconds: 1 });
};
