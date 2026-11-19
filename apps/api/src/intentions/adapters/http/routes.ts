import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AnalyticsEnv } from "../../../platform/analytics-port";
import { visitorCookie } from "../../../platform/visitor";
import type { FindFollowUp } from "../../application/follow-up";
import type { SubmitIntention } from "../../application/submit-intention";
import { intentionTextLength } from "../../domain/intention";

const submission = z.object({
	text: z
		.string()
		.trim()
		.min(intentionTextLength.min)
		.max(intentionTextLength.max),
	turnstileToken: z.string().min(1).max(2048),
});

type IntentionRoutesDeps = {
	submitIntention: SubmitIntention;
	findFollowUp: FindFollowUp;
};

export const intentionRoutes = ({
	submitIntention,
	findFollowUp,
}: IntentionRoutesDeps) => {
	return new Hono<AnalyticsEnv>()
		.use("/intentions", visitorCookie)
		.post("/intentions", zValidator("json", submission), async (c) => {
			const submitted = await submitIntention(
				{ ...c.req.valid("json"), visitorId: c.var.visitorId },
				c.var.analytics,
			);
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
			if (submitted.error.kind === "limit_reached") {
				return c.json({ status: "limit_reached" } as const, 429);
			}
			if (submitted.error.kind === "verification_failed") {
				return c.json({ status: "verification_failed" } as const, 403);
			}
			return c.json({ status: "moderation_unavailable" } as const, 503);
		})
		.get("/intentions/:code", async (c) => {
			const found = await findFollowUp(c.req.param("code"));
			if (!found.ok) return c.json({ status: "not_found" } as const, 404);
			return c.json(
				{
					...found.value,
					publishedAt: found.value.publishedAt.toISOString(),
				},
				200,
			);
		});
};
