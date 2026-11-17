import {
	BedrockRuntimeClient,
	type BedrockRuntimeClientConfig,
	ConverseCommand,
	type ToolInputSchema,
} from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";
import type { Moderate } from "../../application/moderate";
import { answer, asIntention, instructions } from "./moderation-instructions";

const model = {
	id: "amazon.nova-lite-v1:0",
	usdPerMillionTokens: { input: 0.06, output: 0.24 },
};

const verdictTool = {
	name: "record_verdict",
	description: "Record the moderation verdict for the intention.",
	inputSchema: { json: z.toJSONSchema(answer) } as ToolInputSchema,
};

export const createNovaModerator = (
	options: BedrockRuntimeClientConfig = {},
): Moderate => {
	const client = new BedrockRuntimeClient({
		maxAttempts: 2,
		requestHandler: { requestTimeout: 10_000 },
		...options,
	});
	return async (text, analytics) => {
		const startedAt = performance.now();
		try {
			const response = await client.send(
				new ConverseCommand({
					modelId: model.id,
					system: [{ text: instructions }],
					messages: [{ role: "user", content: [{ text: asIntention(text) }] }],
					inferenceConfig: { maxTokens: 1024, temperature: 0 },
					toolConfig: {
						tools: [{ toolSpec: verdictTool }],
						toolChoice: { tool: { name: verdictTool.name } },
					},
				}),
			);
			const inputTokens = response.usage?.inputTokens ?? 0;
			const outputTokens = response.usage?.outputTokens ?? 0;
			analytics.captureLlmGeneration({
				model: model.id,
				inputTokens,
				outputTokens,
				latencyMs: performance.now() - startedAt,
				costUsd:
					(inputTokens * model.usdPerMillionTokens.input +
						outputTokens * model.usdPerMillionTokens.output) /
					1_000_000,
			});
			const toolUse = response.output?.message?.content?.find(
				(block) => block.toolUse?.name === verdictTool.name,
			)?.toolUse;
			if (!toolUse) throw new Error("the moderation answer had no verdict");
			const verdict = answer.parse(toolUse.input);
			if (verdict.reasons.length === 0) {
				return {
					ok: true,
					value: { publishable: true, language: verdict.language },
				};
			}
			return {
				ok: true,
				value: { publishable: false, reasons: verdict.reasons },
			};
		} catch (error) {
			analytics.captureException(error);
			return { ok: false, error: { kind: "moderation_unavailable" } };
		}
	};
};
