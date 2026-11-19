import { type AppDependencies, createApp } from "../src/app";
import { createSubmitIntention, type Moderate } from "../src/intentions";
import {
	createCommit,
	createSearch,
	type Embed,
	type SearchAgent,
} from "../src/intercession";
import { createPostHogAnalytics } from "../src/platform/analytics";
import { createDatabaseProbe } from "../src/platform/database";
import { createSubmissionLimit } from "../src/platform/rate-limit";
import type { VerifyTurnstile } from "../src/platform/turnstile-port";
import { testDatabase } from "./database";

type TestAppOverrides = Partial<AppDependencies> & {
	moderate?: Moderate;
	verifyTurnstile?: VerifyTurnstile;
	embed?: Embed;
	agent?: SearchAgent;
};

const moderationNotExpected: Moderate = async () => {
	throw new Error("this test does not expect a moderation call");
};

const passesTurnstile: VerifyTurnstile = async () => true;

const embeddingNotExpected: Embed = async () => {
	throw new Error("this test does not expect an embedding call");
};

const agentNotExpected: SearchAgent = () => {
	throw new Error("this test does not expect a search agent call");
};

export const createTestApp = ({
	moderate = moderationNotExpected,
	verifyTurnstile = passesTurnstile,
	embed = embeddingNotExpected,
	agent = agentNotExpected,
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
			consumeSubmissionLimit: createSubmissionLimit(testDatabase(), {}),
		}),
		search: createSearch({ database: testDatabase(), embed, agent }),
		commit: createCommit({ database: testDatabase() }),
		...overrides,
	});
