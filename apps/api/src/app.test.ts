import { expect, test } from "bun:test";
import { type AppDependencies, createApp } from "./app";

function fakeAnalytics() {
	const calls: string[] = [];
	const exceptions: unknown[] = [];
	return {
		calls,
		exceptions,
		openAnalytics: () => ({
			captureException: (error: unknown) => {
				calls.push("captureException");
				exceptions.push(error);
			},
			captureLlmGeneration: () => {
				calls.push("captureLlmGeneration");
			},
			shutdown: async () => {
				await Promise.resolve();
				calls.push("shutdown");
			},
		}),
	};
}

function appWith(dependencies: Partial<AppDependencies> = {}) {
	return createApp({
		isDatabaseReachable: async () => true,
		openAnalytics: fakeAnalytics().openAnalytics,
		...dependencies,
	});
}

test("GET /api/health responds 200 when the database is reachable", async () => {
	const app = appWith();

	const response = await app.request("/api/health");

	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ status: "ok", database: "ok" });
});

test("GET /api/health responds 503 when the database is unreachable", async () => {
	const app = appWith({ isDatabaseReachable: async () => false });

	const response = await app.request("/api/health");

	expect(response.status).toBe(503);
	expect(await response.json()).toEqual({
		status: "error",
		database: "unreachable",
	});
});

test("analytics are shut down before a response is returned", async () => {
	const analytics = fakeAnalytics();
	const app = appWith({ openAnalytics: analytics.openAnalytics });

	await app.request("/api/health");

	expect(analytics.calls).toEqual(["shutdown"]);
});

test("an unexpected error is reported to analytics and answered with 500", async () => {
	const analytics = fakeAnalytics();
	const failure = new Error("boom");
	const app = appWith({
		openAnalytics: analytics.openAnalytics,
		isDatabaseReachable: async () => {
			throw failure;
		},
	});

	const response = await app.request("/api/health");

	expect(response.status).toBe(500);
	expect(analytics.exceptions).toEqual([failure]);
	expect(analytics.calls).toEqual(["captureException", "shutdown"]);
});
