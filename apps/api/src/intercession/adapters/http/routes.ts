import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { AnalyticsEnv } from "../../../platform/analytics-port";
import { visitorCookie } from "../../../platform/visitor";
import type { Search } from "../../application/search";
import { internalError, type SearchEvent } from "../../domain/search-event";

const entryLength = { min: 1, max: 1000 };

const text = z.string().trim().min(entryLength.min).max(entryLength.max);

const searchRequest = z.object({
	entry: text,
	clarification: z.object({ question: text, answer: text }).optional(),
});

const asFrame = (event: SearchEvent) => {
	return {
		event: event.type,
		data: JSON.stringify(event.data),
	};
};

export const searchRoutes = (search: Search) => {
	return new Hono<AnalyticsEnv>()
		.use("/search", visitorCookie)
		.post("/search", zValidator("json", searchRequest), (c) => {
			const { entry, clarification } = c.req.valid("json");
			const visitorId = c.var.visitorId;
			const analytics = c.var.analytics;
			return streamSSE(c, async (stream) => {
				try {
					for await (const event of search(
						{ entry, clarification, visitorId },
						analytics,
					)) {
						await stream.writeSSE(asFrame(event));
					}
				} catch (error) {
					analytics.captureException(error);
					await stream.writeSSE(asFrame(internalError));
				}
			});
		});
};
