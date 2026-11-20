import type { Analytics } from "../../platform/analytics-port";
import type { Database } from "../../platform/database";
import type { ConsumeRateLimit } from "../../platform/rate-limit-port";
import type { Result } from "../../platform/result";
import type { Signer } from "../../platform/signature-port";
import type { TokenBudget } from "../../platform/token-budget-port";
import type { VerifyTurnstile } from "../../platform/turnstile-port";
import {
	findCandidatesInCatalog,
	findFewestCommittedInCatalog,
} from "../adapters/persistence/catalog-store";
import { recordSuggestions } from "../adapters/persistence/suggestion-store";
import {
	type FoundIntention,
	maxFindIntentionsCalls,
	toSuggestions,
} from "../domain/presentation";
import { rank } from "../domain/ranking";
import {
	internalError,
	SearchErrorReason,
	type SearchEvent,
	searchError,
	toMatch,
} from "../domain/search-event";
import type { Embed } from "./embed";
import {
	AgentEventType,
	type Clarification,
	type FindIntentionsCall,
	type FindIntentionsResult,
	type SearchAgent,
} from "./search-agent";

type SignedClarification = Clarification & { signature: string };

type SearchRequest = {
	entry: string;
	turnstileToken?: string;
	clarification?: SignedClarification;
	visitorId: string;
};

export type Search = (
	request: SearchRequest,
	analytics: Analytics,
) => AsyncIterable<SearchEvent>;

type SearchDeps = {
	database: Database;
	embed: Embed;
	agent: SearchAgent;
	transcripts: Signer;
	verifyTurnstile: VerifyTurnstile;
	consumeSearchTurn: ConsumeRateLimit;
	tokenBudget: TokenBudget;
};

const transcriptOf = (visitorId: string, entry: string, question: string) => {
	return JSON.stringify([visitorId, entry, question]);
};

export const createSearch = ({
	database,
	embed,
	agent,
	transcripts,
	verifyTurnstile,
	consumeSearchTurn,
	tokenBudget,
}: SearchDeps): Search => {
	const refusalOf = async ({
		entry,
		turnstileToken,
		clarification,
		visitorId,
	}: SearchRequest) => {
		if (clarification) {
			const transcript = transcriptOf(visitorId, entry, clarification.question);
			if (!transcripts.verify(transcript, clarification.signature)) {
				return SearchErrorReason.InvalidTranscript;
			}
		} else if (
			turnstileToken === undefined ||
			!(await verifyTurnstile(turnstileToken))
		) {
			return SearchErrorReason.VerificationFailed;
		}
		if (
			(await tokenBudget.isSpent()) ||
			!(await consumeSearchTurn(visitorId))
		) {
			return SearchErrorReason.LimitReached;
		}
		return undefined;
	};

	const searchTurn = async function* (
		{ entry, clarification: signed, visitorId }: SearchRequest,
		analytics: Analytics,
	): AsyncGenerator<SearchEvent> {
		const clarification = signed && {
			question: signed.question,
			answer: signed.answer,
		};
		yield { type: "status", data: { status: "searching" } };
		const steps: FindIntentionsResult[][] = [];
		const found: FoundIntention[] = [];

		let searchesLeft = maxFindIntentionsCalls;

		const findIntentions = async (
			call: FindIntentionsCall,
		): Promise<Result<FindIntentionsResult, "embedding_failed">> => {
			if (searchesLeft === 0)
				return {
					ok: true,
					value: { call, outcome: { kind: "limit_reached" } },
				};
			searchesLeft -= 1;
			const embedding = await embed(call.query, analytics);
			if (!embedding.ok) return { ok: false, error: "embedding_failed" };
			const intentions = rank(
				await findCandidatesInCatalog(database, {
					embedding: embedding.value,
					language: call.language,
					visitorId,
				}),
			);
			found.push(...intentions);
			return {
				ok: true,
				value: { call, outcome: { kind: "found", intentions } },
			};
		};

		while (true) {
			const mustPresent = searchesLeft === 0;
			let calls: FindIntentionsCall[] | undefined;
			for await (const event of agent(
				{ entry, clarification, steps, mustPresent },
				analytics,
			)) {
				switch (event.type) {
					case AgentEventType.NoteDelta:
						yield { type: "note_delta", data: { text: event.text } };
						break;
					case AgentEventType.FindIntentions:
						calls = event.calls;
						break;
					case AgentEventType.PresentSuggestions: {
						const presented = toSuggestions(event.suggestions, found);
						const language = steps.flat().at(-1)?.call.language;
						const fallback =
							presented.length === 0 && language !== undefined
								? await findFewestCommittedInCatalog(database, language)
								: undefined;
						const suggestions = fallback ?? presented;
						await recordSuggestions(
							database,
							visitorId,
							suggestions.map((suggestion) => suggestion.intentionId),
						);
						yield {
							type: "suggestions",
							data: { match: toMatch(fallback), suggestions },
						};
						yield { type: "done", data: {} };
						return;
					}
					case AgentEventType.AskClarifyingQuestion: {
						if (clarification) {
							yield internalError;
							return;
						}
						const question = event.question.trim();
						yield {
							type: "question",
							data: {
								question,
								signature: transcripts.sign(
									transcriptOf(visitorId, entry, question),
								),
							},
						};
						yield { type: "done", data: {} };
						return;
					}
					case AgentEventType.Unavailable:
						yield internalError;
						return;
				}
			}
			if (!calls || mustPresent) {
				yield internalError;
				return;
			}
			const results: FindIntentionsResult[] = [];
			for (const call of calls) {
				const result = await findIntentions(call);
				if (!result.ok) {
					yield internalError;
					return;
				}
				results.push(result.value);
			}
			steps.push(results);
		}
	};

	return async function* (request, analytics): AsyncGenerator<SearchEvent> {
		const refusal = await refusalOf(request);
		if (refusal) {
			yield searchError(refusal);
			return;
		}
		let tokens = 0;
		const metered: Analytics = {
			captureException: (error) => analytics.captureException(error),
			captureLlmGeneration: (generation) => {
				tokens += generation.inputTokens + generation.outputTokens;
				analytics.captureLlmGeneration(generation);
			},
			shutdown: () => analytics.shutdown(),
		};
		try {
			yield* searchTurn(request, metered);
		} finally {
			if (tokens > 0) await tokenBudget.spend(tokens);
		}
	};
};
