import { type AppDependencies, createApp } from "../src/app";
import { createPostHogAnalytics } from "../src/platform/analytics";
import { createDatabaseProbe } from "../src/platform/database";
import { testDatabase } from "./database";

export const createTestApp = (overrides: Partial<AppDependencies> = {}) =>
	createApp({
		isDatabaseReachable: createDatabaseProbe(testDatabase()),
		openAnalytics: createPostHogAnalytics({
			key: undefined,
			host: "http://posthog.invalid",
		}),
		...overrides,
	});
