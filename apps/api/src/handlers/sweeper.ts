import { createTitanEmbedder } from "../intercession";
import {
	createPostHogAnalytics,
	requirePostHogSettings,
} from "../platform/analytics";
import { createDatabase, requireDatabaseUrl } from "../platform/database";
import { createSweep } from "../sweep";

export const handler = createSweep({
	database: createDatabase(requireDatabaseUrl()),
	embed: createTitanEmbedder(),
	openAnalytics: createPostHogAnalytics(requirePostHogSettings()),
});
