import { streamHandle } from "hono/aws-lambda";
import { createApp } from "../app";
import { createNovaModerator, createSubmitIntention } from "../intentions";
import {
	createPostHogAnalytics,
	requirePostHogSettings,
} from "../platform/analytics";
import {
	createDatabase,
	createDatabaseProbe,
	requireDatabaseUrl,
} from "../platform/database";
import { createSubmissionLimit } from "../platform/rate-limit";
import {
	createTurnstileVerifier,
	requireTurnstileSecret,
} from "../platform/turnstile";

const database = createDatabase(requireDatabaseUrl());
const isDatabaseReachable = createDatabaseProbe(database);
const openAnalytics = createPostHogAnalytics(requirePostHogSettings());
const verifyTurnstile = createTurnstileVerifier({
	secret: requireTurnstileSecret(),
});

export const handler = streamHandle(
	createApp({
		isDatabaseReachable,
		openAnalytics,
		submitIntention: createSubmitIntention({
			database,
			moderate: createNovaModerator(),
			verifyTurnstile,
			consumeSubmissionLimit: createSubmissionLimit(database),
		}),
	}),
);
