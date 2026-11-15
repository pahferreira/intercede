import { createApp } from "./app";
import {
	createDatabaseProbe,
	localOrConfiguredDatabaseUrl,
} from "./platform/database";

const isDatabaseReachable = createDatabaseProbe(localOrConfiguredDatabaseUrl());

const server = Bun.serve({
	port: Number(process.env.API_PORT ?? 3000),
	fetch: createApp({ isDatabaseReachable }).fetch,
});

console.log(`API listening on ${server.url}`);
