import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AnalyticsEnv } from "../../../platform/analytics-port";
import { visitorCookie } from "../../../platform/visitor";
import type { Commit } from "../../application/commit";
import {
	type CommitmentBatch,
	maxCommitmentsPerBatch,
} from "../../domain/commitment";

const commitmentsBody = z.object({
	intentionIds: z.array(z.uuid()).min(1).max(maxCommitmentsPerBatch),
});

export const commitRoutes = (commit: Commit) =>
	new Hono<AnalyticsEnv>()
		.use("/commitments", visitorCookie)
		.post("/commitments", zValidator("json", commitmentsBody), async (c) => {
			const batch: CommitmentBatch = {
				visitorId: c.var.visitorId,
				intentionIds: c.req.valid("json").intentionIds,
			};
			const committed = await commit(batch);
			if (committed.ok) {
				return c.json(
					{ status: "committed", commitments: committed.value } as const,
					201,
				);
			}
			return c.json(
				{
					status: "not_suggested",
					intentionIds: committed.error.intentionIds,
				} as const,
				422,
			);
		});
