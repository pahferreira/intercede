import { expect, test } from "bun:test";
import { createApp } from "./app";

test("GET /api/health responds 200 when the database is reachable", async () => {
	const app = createApp({ checkDatabase: async () => {} });

	const response = await app.request("/api/health");

	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ status: "ok", database: "ok" });
});

test("GET /api/health responds 503 when the database is unreachable", async () => {
	const app = createApp({
		checkDatabase: async () => {
			throw new Error("connection refused");
		},
	});

	const response = await app.request("/api/health");

	expect(response.status).toBe(503);
	expect(await response.json()).toEqual({
		status: "error",
		database: "unreachable",
	});
});
