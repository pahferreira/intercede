import { createApp } from "./app";
import { createNovaModerator, createSubmitIntention } from "./intentions";
import { createPostHogAnalytics, postHogSettings } from "./platform/analytics";
import {
	createDatabase,
	createDatabaseProbe,
	localOrConfiguredDatabaseUrl,
} from "./platform/database";

const database = createDatabase(localOrConfiguredDatabaseUrl());
const isDatabaseReachable = createDatabaseProbe(database);
const openAnalytics = createPostHogAnalytics(postHogSettings());

const server = Bun.serve({
	port: Number(process.env.API_PORT ?? 3000),
	fetch: createApp({
		isDatabaseReachable,
		openAnalytics,
		submitIntention: createSubmitIntention({
			database,
			moderate: createNovaModerator(),
		}),
	}).fetch,
});

console.log(`API listening on ${server.url}`);
