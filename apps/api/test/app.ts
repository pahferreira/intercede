import { type AppDependencies, createApp } from "../src/app";
import { createSubmitIntention, type Moderate } from "../src/intentions";
import { createPostHogAnalytics } from "../src/platform/analytics";
import { createDatabaseProbe } from "../src/platform/database";
import { testDatabase } from "./database";

type TestAppOverrides = Partial<AppDependencies> & { moderate?: Moderate };

const moderationNotExpected: Moderate = async () => {
	throw new Error("this test does not expect a moderation call");
};

export const createTestApp = ({
	moderate = moderationNotExpected,
	...overrides
}: TestAppOverrides = {}) =>
	createApp({
		isDatabaseReachable: createDatabaseProbe(testDatabase()),
		openAnalytics: createPostHogAnalytics({
			key: undefined,
			host: "http://posthog.invalid",
		}),
		submitIntention: createSubmitIntention({
			database: testDatabase(),
			moderate,
		}),
		...overrides,
	});
