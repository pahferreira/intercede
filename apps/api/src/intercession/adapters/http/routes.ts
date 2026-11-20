import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { AnalyticsEnv } from "../../../platform/analytics-port";
import { visitorCookie } from "../../../platform/visitor";
import type { Search } from "../../application/search";
import { maxSuggestions } from "../../domain/presentation";
import { internalError, type SearchEvent } from "../../domain/search-event";

const entryLength = { min: 1, max: 1000 };

const boundedText = z.string().trim().min(entryLength.min).max(entryLength.max);

const clarification = z.object({
	question: boundedText,
	answer: boundedText,
});

const transcriptTurn = z.object({
	entry: boundedText,
	clarification: clarification.optional(),
	note: z.string().max(4000),
	suggestions: z
		.array(
			z.object({
				intentionId: z.string().max(64),
				text: z.string().max(4000),
				whyNote: z.string().max(1000).optional(),
			}),
		)
		.max(maxSuggestions),
});

const signature = z.string().min(1).max(128);

const searchRequest = z.object({
	entry: boundedText,
	turnstileToken: z.string().min(1).max(2048).optional(),
	clarification: clarification.extend({ signature }).optional(),
	transcript: z
		.object({ turns: z.array(transcriptTurn).min(1), signature })
		.optional(),
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
			const { entry, turnstileToken, clarification, transcript } =
				c.req.valid("json");
			const visitorId = c.var.visitorId;
			const analytics = c.var.analytics;
			return streamSSE(c, async (stream) => {
				try {
					for await (const event of search(
						{ entry, turnstileToken, clarification, transcript, visitorId },
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
