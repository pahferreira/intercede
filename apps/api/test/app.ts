import { type AppDependencies, createApp } from "../src/app";
import {
	createFindFollowUp,
	createSubmitIntention,
	type Moderate,
} from "../src/intentions";
import {
	createCommit,
	createCountCommitments,
	createSearch,
	type Embed,
	type SearchAgent,
} from "../src/intercession";
import { createPostHogAnalytics } from "../src/platform/analytics";
import { createDatabaseProbe } from "../src/platform/database";
import {
	createSearchTurnLimit,
	createSubmissionLimit,
} from "../src/platform/rate-limit";
import type { ConsumeRateLimit } from "../src/platform/rate-limit-port";
import { createHmacSigner } from "../src/platform/signature";
import type { Signer } from "../src/platform/signature-port";
import { createSearchTokenBudget } from "../src/platform/token-budget";
import type { TokenBudget } from "../src/platform/token-budget-port";
import type { VerifyTurnstile } from "../src/platform/turnstile-port";
import { testDatabase } from "./database";

type TestAppOverrides = Partial<AppDependencies> & {
	moderate?: Moderate;
	verifyTurnstile?: VerifyTurnstile;
	embed?: Embed;
	agent?: SearchAgent;
	consumeSearchTurn?: ConsumeRateLimit;
	tokenBudget?: TokenBudget;
	transcriptSigner?: Signer;
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
	consumeSearchTurn = createSearchTurnLimit(testDatabase(), {}),
	tokenBudget = createSearchTokenBudget(testDatabase(), {}),
	transcriptSigner = createHmacSigner("test-transcript-key"),
	...overrides
}: TestAppOverrides = {}) => {
	return createApp({
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
		findFollowUp: createFindFollowUp({
			database: testDatabase(),
			countCommitments: createCountCommitments({ database: testDatabase() }),
		}),
		search: createSearch({
			database: testDatabase(),
			embed,
			agent,
			transcriptSigner,
			verifyTurnstile,
			consumeSearchTurn,
			tokenBudget,
		}),
		commit: createCommit({ database: testDatabase() }),
		...overrides,
	});
};
