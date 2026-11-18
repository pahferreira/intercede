import { createDrainOutbox } from "./intentions";
import { createKeepCatalogInStep, type Embed } from "./intercession";
import type { OpenAnalytics } from "./platform/analytics-port";
import type { Database } from "./platform/database";

type SweepDependencies = {
	database: Database;
	embed: Embed;
	openAnalytics: OpenAnalytics;
};

export const createSweep = ({
	database,
	embed,
	openAnalytics,
}: SweepDependencies) => {
	const drainOutbox = createDrainOutbox(database);
	const keepCatalogInStep = createKeepCatalogInStep({ database, embed });
	return async () => {
		const analytics = openAnalytics();
		try {
			const { dispatched, pending } = await drainOutbox((event) =>
				keepCatalogInStep(event, analytics),
			);
			console.info(
				`sweeper tick: ${dispatched} events dispatched, ${pending} left for the next tick`,
			);
		} catch (error) {
			analytics.captureException(error);
			throw error;
		} finally {
			await analytics.shutdown();
		}
	};
};
