import {
	AnthropicBedrock,
	type ClientOptions as BedrockClientOptions,
} from "@anthropic-ai/bedrock-sdk";
import type {
	MessageParam,
	Tool,
	ToolChoice,
} from "@anthropic-ai/sdk/resources/messages";
import type {
	AgentEvent,
	FindIntentionsResult,
	SearchAgent,
	SearchAgentTurn,
} from "../../application/search-agent";
import {
	asEntry,
	findIntentionsInput,
	instructions,
	limitReachedResult,
	noteSoFar,
	presentSuggestionsInput,
	tools,
} from "./search-instructions";

const model = {
	id: "global.anthropic.claude-haiku-5-5",
	usdPerMillionTokens: { input: 0.1, output: 0.5 },
};

const claudeTools: Tool[] = tools.map(({ name, description, inputSchema }) => ({
	name,
	description,
	input_schema: inputSchema,
}));

const toolResult = ({ call, outcome }: FindIntentionsResult) => {
	return outcome.kind === "found"
		? {
				type: "tool_result" as const,
				tool_use_id: call.id,
				content: JSON.stringify(outcome.intentions),
			}
		: {
				type: "tool_result" as const,
				tool_use_id: call.id,
				content: limitReachedResult,
				is_error: true,
			};
};

const messagesFor = ({ entry, steps }: SearchAgentTurn): MessageParam[] => {
	return [
		{ role: "user", content: asEntry(entry) },
		...steps.flatMap((results): MessageParam[] => [
			{
				role: "assistant",
				content: results.map(({ call }) => ({
					type: "tool_use" as const,
					id: call.id,
					name: "find_intentions",
					input: { query: call.query },
				})),
			},
			{ role: "user", content: results.map(toolResult) },
		]),
	];
};

const toolChoiceFor = ({ mustPresent }: SearchAgentTurn): ToolChoice => {
	return mustPresent
		? { type: "tool", name: "present_suggestions" }
		: { type: "any" };
};

export const createClaudeSearchAgent = (
	options: Omit<
		BedrockClientOptions,
		"awsAccessKey" | "awsSecretKey" | "awsSessionToken"
	> = {},
): SearchAgent => {
	const client = new AnthropicBedrock({
		timeout: 20_000,
		maxRetries: 1,
		...options,
	});
	return async function* (turn, analytics): AsyncGenerator<AgentEvent> {
		const startedAt = performance.now();
		try {
			const stream = client.messages.stream({
				model: model.id,
				max_tokens: 1024,
				system: instructions,
				tools: claudeTools,
				tool_choice: toolChoiceFor(turn),
				messages: messagesFor(turn),
			});
			const inputs = new Map<number, { name: string; json: string }>();
			let streamedNote = "";
			for await (const event of stream) {
				if (
					event.type === "content_block_start" &&
					event.content_block.type === "tool_use"
				) {
					inputs.set(event.index, {
						name: event.content_block.name,
						json: "",
					});
				}
				if (
					event.type === "content_block_delta" &&
					event.delta.type === "input_json_delta"
				) {
					const input = inputs.get(event.index);
					if (!input) continue;
					input.json += event.delta.partial_json;
					if (input.name !== "present_suggestions") continue;
					const note = noteSoFar(input.json);
					if (note.length > streamedNote.length) {
						yield { type: "note_delta", text: note.slice(streamedNote.length) };
						streamedNote = note;
					}
				}
			}
			const message = await stream.finalMessage();
			const { input_tokens, output_tokens } = message.usage;
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
			const toolUses = message.content.flatMap((block) =>
				block.type === "tool_use" ? [block] : [],
			);
			const presentation = toolUses.find(
				(block) => block.name === "present_suggestions",
			);
			if (presentation) {
				const { suggestions } = presentSuggestionsInput.parse(
					presentation.input,
				);
				yield { type: "present_suggestions", suggestions };
				return;
			}
			const calls = toolUses
				.filter((block) => block.name === "find_intentions")
				.map((block) => ({
					id: block.id,
					query: findIntentionsInput.parse(block.input).query,
				}));
			if (calls.length > 0) yield { type: "find_intentions", calls };
		} catch (error) {
			analytics.captureException(error);
			yield { type: "unavailable" };
		}
	};
};
