import type { Embed } from "../src/intercession";
import { createPostHogAnalytics } from "../src/platform/analytics";
import { createSweep } from "../src/sweep";
import { testDatabase } from "./database";

const embeddingNotExpected: Embed = async () => {
	throw new Error("this test does not expect an embedding call");
};

export const createTestSweep = ({
	embed = embeddingNotExpected,
}: {
	embed?: Embed;
} = {}) =>
	createSweep({
		database: testDatabase(),
		embed,
		openAnalytics: createPostHogAnalytics({
			key: undefined,
			host: "http://posthog.invalid",
		}),
	});
