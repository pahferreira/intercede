import { createApp } from "./app";
import { createNovaModerator, createSubmitIntention } from "./intentions";
import { createPostHogAnalytics, postHogSettings } from "./platform/analytics";
import {
	createDatabase,
	createDatabaseProbe,
	localOrConfiguredDatabaseUrl,
} from "./platform/database";
import { createSubmissionLimit } from "./platform/rate-limit";
import {
	createTurnstileVerifier,
	localOrConfiguredTurnstileSecret,
} from "./platform/turnstile";

const database = createDatabase(localOrConfiguredDatabaseUrl());
const isDatabaseReachable = createDatabaseProbe(database);
const openAnalytics = createPostHogAnalytics(postHogSettings());
const verifyTurnstile = createTurnstileVerifier({
	secret: localOrConfiguredTurnstileSecret(),
});

const server = Bun.serve({
	port: Number(process.env.API_PORT ?? 3000),
	fetch: createApp({
		isDatabaseReachable,
		openAnalytics,
		submitIntention: createSubmitIntention({
			database,
			moderate: createNovaModerator(),
			verifyTurnstile,
			consumeSubmissionLimit: createSubmissionLimit(database),
		}),
	}).fetch,
});

console.log(`API listening on ${server.url}`);
