import {
	BedrockRuntimeClient,
	type BedrockRuntimeClientConfig,
	InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";
import { type Embed, embeddingDimensions } from "../../application/embed";

const model = {
	id: "amazon.titan-embed-text-v2:0",
	usdPerMillionInputTokens: 0.02,
};

const answer = z.object({
	embedding: z.array(z.number()).length(embeddingDimensions),
	inputTextTokenCount: z.number(),
});

export const createTitanEmbedder = (
	options: BedrockRuntimeClientConfig = {},
): Embed => {
	const client = new BedrockRuntimeClient({
		maxAttempts: 2,
		requestHandler: { requestTimeout: 10_000 },
		...options,
	});
	return async (text, analytics) => {
		const startedAt = performance.now();
		try {
			const response = await client.send(
				new InvokeModelCommand({
					modelId: model.id,
					contentType: "application/json",
					accept: "application/json",
					body: JSON.stringify({
						inputText: text,
						dimensions: embeddingDimensions,
						normalize: true,
					}),
				}),
			);
			const { embedding, inputTextTokenCount } = answer.parse(
				JSON.parse(new TextDecoder().decode(response.body)),
			);
			analytics.captureLlmGeneration({
				model: model.id,
				inputTokens: inputTextTokenCount,
				outputTokens: 0,
				latencyMs: performance.now() - startedAt,
				costUsd:
					(inputTextTokenCount * model.usdPerMillionInputTokens) / 1_000_000,
			});
			return { ok: true, value: embedding };
		} catch (error) {
			analytics.captureException(error);
			return { ok: false, error: { kind: "embedding_unavailable" } };
		}
	};
};
