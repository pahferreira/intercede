import { useMutation } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import { track } from "../analytics";
import type { ApiClient } from "../api";

type PostIntention = ApiClient["api"]["intentions"]["$post"];
type Submission = InferResponseType<PostIntention, 201 | 422 | 503>;
type Published = InferResponseType<PostIntention, 201>;
export type RejectionReason = InferResponseType<
	PostIntention,
	422
>["reasons"][number];

type SubmissionIntentionOptions = {
	onPublished?: (published: Published) => unknown;
};

export function useSubmissionIntention(
	options: SubmissionIntentionOptions = {},
) {
	const { client } = useRouteContext({ from: "__root__" });

	return useMutation({
		mutationFn: async (intention: string): Promise<Submission> => {
			const response = await client.api.intentions.$post({
				json: { text: intention },
			});
			if (
				response.status === 201 ||
				response.status === 422 ||
				response.status === 503
			) {
				return response.json();
			}
			throw new Error(`unexpected status ${response.status}`);
		},
		onSuccess: (result) => {
			if (result.status === "published") {
				track("intention_submitted", {});
				return options.onPublished?.(result);
			}
			if (result.status === "rejected") {
				for (const reason of result.reasons) {
					track("intention_rejected", { reason });
				}
			}
		},
	});
}
