import { streamHandle } from "hono/aws-lambda";
import { createApp } from "../app";
import { createBedrockModerator, createSubmitIntention } from "../intentions";
import {
	createPostHogAnalytics,
	requirePostHogSettings,
} from "../platform/analytics";
import {
	createDatabase,
	createDatabaseProbe,
	requireDatabaseUrl,
} from "../platform/database";

const database = createDatabase(requireDatabaseUrl());
const isDatabaseReachable = createDatabaseProbe(database);
const openAnalytics = createPostHogAnalytics(requirePostHogSettings());

export const handler = streamHandle(
	createApp({
		isDatabaseReachable,
		openAnalytics,
		submitIntention: createSubmitIntention({
			database,
			moderate: createBedrockModerator(),
		}),
	}),
);
