import { createApp } from "./app";
import { createNovaModerator, createSubmitIntention } from "./intentions";
import { createPostHogAnalytics, postHogSettings } from "./platform/analytics";
import {
	createDatabase,
	createDatabaseProbe,
	localOrConfiguredDatabaseUrl,
} from "./platform/database";
import { createDailyRateLimit, submissionsPerDay } from "./platform/rate-limit";
import { createTurnstileVerifier } from "./platform/turnstile";

const alwaysPassesTurnstileSecret = "1x0000000000000000000000000000000AA";

const database = createDatabase(localOrConfiguredDatabaseUrl());
const isDatabaseReachable = createDatabaseProbe(database);
const openAnalytics = createPostHogAnalytics(postHogSettings());
const verifyTurnstile = createTurnstileVerifier({
	secret: process.env.TURNSTILE_SECRET_KEY ?? alwaysPassesTurnstileSecret,
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
			consumeSubmissionLimit: createDailyRateLimit(database, {
				action: "submission",
				limit: submissionsPerDay(),
			}),
		}),
	}).fetch,
});

console.log(`API listening on ${server.url}`);
