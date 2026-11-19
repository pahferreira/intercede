import {
	BedrockRuntimeClient,
	type BedrockRuntimeClientConfig,
	type ContentBlock,
	ConverseStreamCommand,
	type Message,
	type Tool,
	type ToolChoice,
	type ToolInputSchema,
} from "@aws-sdk/client-bedrock-runtime";
import {
	type AgentEvent,
	askClarifyingQuestion,
	type FindIntentionsResult,
	type SearchAgent,
	type SearchAgentTurn,
} from "../../application/search-agent";
import {
	asEntry,
	clarifyingQuestionFrom,
	findIntentionsInput,
	instructions,
	limitReachedResult,
	noteSoFar,
	presentSuggestionsInput,
	type ToolDefinition,
	toolsFor,
} from "./search-instructions";

const model = {
	id: "amazon.nova-lite-v1:0",
	usdPerMillionTokens: { input: 0.06, output: 0.24 },
};

const asNovaTool = ({
	name,
	description,
	inputSchema,
}: ToolDefinition): Tool => {
	return {
		toolSpec: {
			name,
			description,
			inputSchema: { json: inputSchema } as ToolInputSchema,
		},
	};
};

const toolResult = ({ call, outcome }: FindIntentionsResult): ContentBlock => {
	return outcome.kind === "found"
		? {
				toolResult: {
					toolUseId: call.id,
					content: [{ text: JSON.stringify(outcome.intentions) }],
				},
			}
		: {
				toolResult: {
					toolUseId: call.id,
					content: [{ text: limitReachedResult }],
					status: "error",
				},
			};
};

const messagesFor = (turn: SearchAgentTurn): Message[] => {
	return [
		{ role: "user", content: [{ text: asEntry(turn) }] },
		...turn.steps.flatMap((results): Message[] => [
			{
				role: "assistant",
				content: results.map(({ call }) => ({
					toolUse: {
						toolUseId: call.id,
						name: "find_intentions",
						input: { query: call.query },
					},
				})),
			},
			{ role: "user", content: results.map(toolResult) },
		]),
	];
};

const toolChoiceFor = ({ mustPresent }: SearchAgentTurn): ToolChoice => {
	return mustPresent ? { tool: { name: "present_suggestions" } } : { any: {} };
};

export const createNovaSearchAgent = (
	options: BedrockRuntimeClientConfig = {},
): SearchAgent => {
	const client = new BedrockRuntimeClient({
		maxAttempts: 2,
		requestHandler: { requestTimeout: 20_000 },
		...options,
	});
	return async function* (turn, analytics): AsyncGenerator<AgentEvent> {
		const startedAt = performance.now();
		try {
			const response = await client.send(
				new ConverseStreamCommand({
					modelId: model.id,
					system: [{ text: instructions }],
					messages: messagesFor(turn),
					inferenceConfig: { maxTokens: 1024, temperature: 0 },
					toolConfig: {
						tools: toolsFor(turn).map(asNovaTool),
						toolChoice: toolChoiceFor(turn),
					},
				}),
			);
			const inputs = new Map<
				number,
				{ id: string; name: string; json: string }
			>();
			let streamedNote = "";
			let inputTokens = 0;
			let outputTokens = 0;
			for await (const event of response.stream ?? []) {
				const start = event.contentBlockStart;
				if (start?.start?.toolUse) {
					inputs.set(start.contentBlockIndex ?? 0, {
						id: start.start.toolUse.toolUseId ?? "",
						name: start.start.toolUse.name ?? "",
						json: "",
					});
				}
				const delta = event.contentBlockDelta;
				if (delta?.delta?.toolUse) {
					const input = inputs.get(delta.contentBlockIndex ?? 0);
					if (!input) continue;
					input.json += delta.delta.toolUse.input ?? "";
					if (input.name !== "present_suggestions") continue;
					const note = noteSoFar(input.json);
					if (note.length > streamedNote.length) {
						yield { type: "note_delta", text: note.slice(streamedNote.length) };
						streamedNote = note;
					}
				}
				if (event.metadata?.usage) {
					inputTokens = event.metadata.usage.inputTokens ?? 0;
					outputTokens = event.metadata.usage.outputTokens ?? 0;
				}
			}
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
			const toolUses = [...inputs.values()];
			const presentation = toolUses.find(
				(toolUse) => toolUse.name === "present_suggestions",
			);
			if (presentation) {
				const { suggestions } = presentSuggestionsInput.parse(
					JSON.parse(presentation.json),
				);
				yield { type: "present_suggestions", suggestions };
				return;
			}
			const question = toolUses.find(
				(toolUse) => toolUse.name === askClarifyingQuestion,
			);
			if (question) {
				yield clarifyingQuestionFrom(JSON.parse(question.json));
				return;
			}
			const calls = toolUses
				.filter((toolUse) => toolUse.name === "find_intentions")
				.map((toolUse) => ({
					id: toolUse.id,
					query: findIntentionsInput.parse(JSON.parse(toolUse.json)).query,
				}));
			if (calls.length > 0) yield { type: "find_intentions", calls };
		} catch (error) {
			analytics.captureException(error);
			yield { type: "unavailable" };
		}
	};
};
