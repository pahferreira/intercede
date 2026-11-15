import { Hono } from "hono";

export type AppDependencies = {
	checkDatabase: () => Promise<void>;
};

export const createApp = ({ checkDatabase }: AppDependencies) =>
	new Hono().basePath("/api").get("/health", async (c) => {
		try {
			await checkDatabase();
			return c.json({ status: "ok", database: "ok" } as const, 200);
		} catch {
			return c.json({ status: "error", database: "unreachable" } as const, 503);
		}
	});

export type AppType = ReturnType<typeof createApp>;
