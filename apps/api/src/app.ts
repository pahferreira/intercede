import { Hono } from "hono";

// Routes are chained so Hono RPC can infer AppType (ADR-0011).
export const app = new Hono()
	.basePath("/api")
	.get("/health", (c) => c.json({ status: "ok" }));

export type AppType = typeof app;
