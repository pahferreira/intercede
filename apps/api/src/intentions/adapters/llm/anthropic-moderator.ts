import {
	AnthropicBedrock,
	type ClientOptions as BedrockClientOptions,
} from "@anthropic-ai/bedrock-sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Moderate } from "../../application/moderate";
import { answer, asIntention, instructions } from "./moderation-instructions";

const model = {
	id: "global.anthropic.claude-haiku-5-5",
	usdPerMillionTokens: { input: 0.1, output: 0.5 },
};

export const createAnthropicModerator = (
	options: Omit<
		BedrockClientOptions,
		"awsAccessKey" | "awsSecretKey" | "awsSessionToken"
	> = {},
): Moderate => {
	const client = new AnthropicBedrock({
		timeout: 10_000,
		maxRetries: 1,
		...options,
	});
	return async (text, analytics) => {
		const startedAt = performance.now();
		try {
			const response = await client.messages.parse({
				model: model.id,
				max_tokens: 1024,
				output_config: { effort: "low", format: zodOutputFormat(answer) },
				system: instructions,
				messages: [{ role: "user", content: asIntention(text) }],
			});
			const { input_tokens, output_tokens } = response.usage;
			analytics.captureLlmGeneration({
				model: model.id,
				inputTokens: input_tokens,
				outputTokens: output_tokens,
				latencyMs: performance.now() - startedAt,
				costUsd:
					(input_tokens * model.usdPerMillionTokens.input +
						output_tokens * model.usdPerMillionTokens.output) /
					1_000_000,
			});
			const verdict = response.parsed_output;
			if (!verdict) throw new Error("the moderation answer was not parsed");
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
