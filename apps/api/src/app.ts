import { Hono } from "hono";
import {
	type FindFollowUp,
	intentionRoutes,
	type SubmitIntention,
} from "./intentions";
import {
	type Commit,
	commitRoutes,
	type Search,
	searchRoutes,
} from "./intercession";
import type {
	Analytics,
	AnalyticsEnv,
	OpenAnalytics,
} from "./platform/analytics-port";

const shuttingDownWhenDone = (
	body: ReadableStream<Uint8Array>,
	analytics: Analytics,
) => {
	const reader = body.getReader();
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			const { done, value } = await reader.read();
			if (done) {
				await analytics.shutdown();
				controller.close();
				return;
			}
			controller.enqueue(value);
		},
		async cancel(reason) {
			await reader.cancel(reason);
			await analytics.shutdown();
		},
	});
};

export type AppDependencies = {
	isDatabaseReachable: () => Promise<boolean>;
	openAnalytics: OpenAnalytics;
	submitIntention: SubmitIntention;
	findFollowUp: FindFollowUp;
	search: Search;
	commit: Commit;
};

export const createApp = ({
	isDatabaseReachable,
	openAnalytics,
	submitIntention,
	findFollowUp,
	search,
	commit,
}: AppDependencies) => {
	return new Hono<AnalyticsEnv>()
		.basePath("/api")
		.use(async (c, next) => {
			const analytics = openAnalytics();
			c.set("analytics", analytics);
			let streaming = false;
			try {
				await next();
				const body = c.res.body;
				streaming =
					body !== null &&
					(c.res.headers.get("content-type") ?? "").startsWith(
						"text/event-stream",
					);
				if (body && streaming) {
					c.res = new Response(shuttingDownWhenDone(body, analytics), c.res);
				}
			} finally {
				if (!streaming) await analytics.shutdown();
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
		.route("/", intentionRoutes({ submitIntention, findFollowUp }))
		.route("/", searchRoutes(search))
		.route("/", commitRoutes(commit));
};

export type AppType = ReturnType<typeof createApp>;
export type {
	Clarification,
	Commitment,
	SearchEvent,
	SignedClarification,
	SignedTranscript,
	Suggestion,
	SuggestionMatch,
	TranscriptTurn,
} from "./intercession";
