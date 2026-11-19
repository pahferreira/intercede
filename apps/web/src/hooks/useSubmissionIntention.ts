import { useMutation } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import { track } from "../analytics";
import type { ApiClient } from "../api";

const answeredStatuses = [201, 403, 422, 429, 503] as const;

type AnsweredStatus = (typeof answeredStatuses)[number];
type PostIntention = ApiClient["api"]["intentions"]["$post"];
type Submission = InferResponseType<PostIntention, AnsweredStatus>;
type Published = InferResponseType<PostIntention, 201>;
export type RejectionReason = InferResponseType<
	PostIntention,
	422
>["reasons"][number];

function isAnswered<Response extends { status: number }>(
	response: Response,
): response is Extract<Response, { status: AnsweredStatus }> {
	return answeredStatuses.some((status) => status === response.status);
}

type SubmissionIntentionOptions = {
	turnstileToken: () => Promise<string>;
	onPublished?: (published: Published) => unknown;
};

export function useSubmissionIntention(options: SubmissionIntentionOptions) {
	const { client } = useRouteContext({ from: "__root__" });

	return useMutation({
		mutationFn: async (intention: string): Promise<Submission> => {
			const turnstileToken = await options.turnstileToken().catch(() => null);
			if (!turnstileToken) return { status: "verification_failed" };
			const response = await client.api.intentions.$post({
				json: { text: intention, turnstileToken },
			});
			if (isAnswered(response)) return response.json();
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
