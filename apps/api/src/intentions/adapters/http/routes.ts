import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AnalyticsEnv } from "../../../platform/analytics-port";
import { visitorCookie } from "../../../platform/visitor";
import type { SubmitIntention } from "../../application/submit-intention";
import { intentionTextLength } from "../../domain/intention";

const submission = z.object({
	text: z
		.string()
		.trim()
		.min(intentionTextLength.min)
		.max(intentionTextLength.max),
});

export const intentionRoutes = (submitIntention: SubmitIntention) =>
	new Hono<AnalyticsEnv>()
		.use("/intentions", visitorCookie)
		.post("/intentions", zValidator("json", submission), async (c) => {
			const { text } = c.req.valid("json");
			const submitted = await submitIntention(text, c.var.analytics);
			if (submitted.ok) {
				return c.json(
					{ status: "published", ...submitted.value } as const,
					201,
				);
			}
			if (submitted.error.kind === "rejected") {
				return c.json(
					{ status: "rejected", reasons: submitted.error.reasons } as const,
					422,
				);
			}
			return c.json({ status: "moderation_unavailable" } as const, 503);
		});
