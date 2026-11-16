import { Hono } from "hono";
import type { Analytics, OpenAnalytics } from "./platform/analytics";

export type AppDependencies = {
	isDatabaseReachable: () => Promise<boolean>;
	openAnalytics: OpenAnalytics;
};

export const createApp = ({
	isDatabaseReachable,
	openAnalytics,
}: AppDependencies) =>
	new Hono<{ Variables: { analytics: Analytics } }>()
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
		});

export type AppType = ReturnType<typeof createApp>;
