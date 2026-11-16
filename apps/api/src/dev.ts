import { createApp } from "./app";
import { createPostHogAnalytics, postHogSettings } from "./platform/analytics";
import {
	createDatabaseProbe,
	localOrConfiguredDatabaseUrl,
} from "./platform/database";

const isDatabaseReachable = createDatabaseProbe(localOrConfiguredDatabaseUrl());
const openAnalytics = createPostHogAnalytics(postHogSettings());

const server = Bun.serve({
	port: Number(process.env.API_PORT ?? 3000),
	fetch: createApp({ isDatabaseReachable, openAnalytics }).fetch,
});

console.log(`API listening on ${server.url}`);
