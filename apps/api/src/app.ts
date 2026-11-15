import { Hono } from "hono";

export type AppDependencies = {
	isDatabaseReachable: () => Promise<boolean>;
};

export const createApp = ({ isDatabaseReachable }: AppDependencies) =>
	new Hono().basePath("/api").get("/health", async (c) => {
		if (await isDatabaseReachable()) {
			return c.json({ status: "ok", database: "ok" } as const, 200);
		}
		return c.json({ status: "error", database: "unreachable" } as const, 503);
	});

export type AppType = ReturnType<typeof createApp>;
