import type { Analytics } from "../../platform/analytics-port";
import type { Database } from "../../platform/database";
import type { Result } from "../../platform/result";
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
	type SearchEvent,
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

export type Search = (
	request: { entry: string; clarification?: Clarification; visitorId: string },
	analytics: Analytics,
) => AsyncIterable<SearchEvent>;

export const createSearch = ({
	database,
	embed,
	agent,
}: {
	database: Database;
	embed: Embed;
	agent: SearchAgent;
}): Search => {
	return async function* (
		{ entry, clarification, visitorId },
		analytics,
	): AsyncGenerator<SearchEvent> {
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
					case AgentEventType.AskClarifyingQuestion:
						if (clarification) {
							yield internalError;
							return;
						}
						yield { type: "question", data: { question: event.question } };
						yield { type: "done", data: {} };
						return;
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
};
