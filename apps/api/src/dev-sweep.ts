import { createTitanEmbedder } from "./intercession";
import type { Analytics } from "./platform/analytics-port";
import {
	createDatabase,
	localOrConfiguredDatabaseUrl,
} from "./platform/database";
import { createSweep } from "./sweep";

const noAnalytics: Analytics = {
	captureException: () => {},
	captureLlmGeneration: () => {},
	shutdown: async () => {},
};

const sweep = createSweep({
	database: createDatabase(localOrConfiguredDatabaseUrl()),
	embed: createTitanEmbedder(),
	openAnalytics: () => noAnalytics,
});

await sweep();
process.exit(0);
