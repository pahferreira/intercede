import { streamHandle } from "hono/aws-lambda";
import { createApp } from "../app";
import {
	createPostHogAnalytics,
	requirePostHogSettings,
} from "../platform/analytics";
import {
	createDatabase,
	createDatabaseProbe,
	requireDatabaseUrl,
} from "../platform/database";

const isDatabaseReachable = createDatabaseProbe(
	createDatabase(requireDatabaseUrl()),
);
const openAnalytics = createPostHogAnalytics(requirePostHogSettings());

export const handler = streamHandle(
	createApp({ isDatabaseReachable, openAnalytics }),
);
