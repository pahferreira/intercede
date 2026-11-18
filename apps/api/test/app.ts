import { type AppDependencies, createApp } from "../src/app";
import { createSubmitIntention, type Moderate } from "../src/intentions";
import { createPostHogAnalytics } from "../src/platform/analytics";
import { createDatabaseProbe } from "../src/platform/database";
import {
	createDailyRateLimit,
	submissionsPerDay,
} from "../src/platform/rate-limit";
import type { VerifyTurnstile } from "../src/platform/turnstile-port";
import { testDatabase } from "./database";

type TestAppOverrides = Partial<AppDependencies> & {
	moderate?: Moderate;
	verifyTurnstile?: VerifyTurnstile;
};

const moderationNotExpected: Moderate = async () => {
	throw new Error("this test does not expect a moderation call");
};

const passesTurnstile: VerifyTurnstile = async () => true;

export const createTestApp = ({
	moderate = moderationNotExpected,
	verifyTurnstile = passesTurnstile,
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
			verifyTurnstile,
			consumeSubmissionLimit: createDailyRateLimit(testDatabase(), {
				action: "submission",
				limit: submissionsPerDay({}),
			}),
		}),
		...overrides,
	});
