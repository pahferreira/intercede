import { Hono } from "hono";
import { intentionRoutes, type SubmitIntention } from "./intentions";
import type { AnalyticsEnv, OpenAnalytics } from "./platform/analytics-port";

export type AppDependencies = {
	isDatabaseReachable: () => Promise<boolean>;
	openAnalytics: OpenAnalytics;
	submitIntention: SubmitIntention;
};

export const createApp = ({
	isDatabaseReachable,
	openAnalytics,
	submitIntention,
}: AppDependencies) =>
	new Hono<AnalyticsEnv>()
		.basePath("/api")
		.use(async (c, next) => {
			const analytics = openAnalytics();
			c.set("analytics", analytics);
			try {
				await next();
			} finally {
				await analytics.shutdown();
			}
		})
		.onError((error, c) => {
			c.var.analytics.captureException(error);
			return c.json({ status: "error" } as const, 500);
		})
		.get("/health", async (c) => {
			if (await isDatabaseReachable()) {
				return c.json({ status: "ok", database: "ok" } as const, 200);
			}
			return c.json({ status: "error", database: "unreachable" } as const, 503);
		})
		.route("/", intentionRoutes(submitIntention));

export type AppType = ReturnType<typeof createApp>;
export type { SearchEvent, Suggestion } from "./intercession";
