import type { Analytics } from "../../platform/analytics-port";
import type { Database } from "../../platform/database";
import { findNearestInCatalog } from "../adapters/persistence/catalog-store";
import { recordSuggestions } from "../adapters/persistence/suggestion-store";
import {
	type FoundIntention,
	maxFindIntentionsCalls,
	toSuggestions,
} from "../domain/presentation";
import type { SearchEvent } from "../domain/search-event";
import type { Embed } from "./embed";
import type {
	FindIntentionsCall,
	FindIntentionsResult,
	SearchAgent,
} from "./search-agent";

export type SearchRequest = { entry: string; visitorId: string };

export type Search = (
	request: SearchRequest,
	analytics: Analytics,
) => AsyncIterable<SearchEvent>;

const failed: SearchEvent = { type: "error", data: { reason: "internal" } };

export const createSearch = ({
	database,
	embed,
	agent,
}: {
	database: Database;
	embed: Embed;
	agent: SearchAgent;
}): Search =>
	async function* (
		{ entry, visitorId },
		analytics,
	): AsyncGenerator<SearchEvent> {
		yield { type: "status", data: { status: "searching" } };
		const steps: FindIntentionsResult[][] = [];
		const found: FoundIntention[] = [];

		let searchesLeft = maxFindIntentionsCalls;

		const findIntentions = async (
			call: FindIntentionsCall,
		): Promise<FindIntentionsResult | undefined> => {
			if (searchesLeft === 0)
				return { call, outcome: { kind: "limit_reached" } };
			searchesLeft -= 1;
			const embedding = await embed(call.query, analytics);
			if (!embedding.ok) return undefined;
			const intentions = await findNearestInCatalog(database, embedding.value);
			found.push(...intentions);
			return { call, outcome: { kind: "found", intentions } };
		};

		while (true) {
			const mustPresent = searchesLeft === 0;
			let calls: FindIntentionsCall[] | undefined;
			for await (const event of agent(
				{ entry, steps, mustPresent },
				analytics,
			)) {
				switch (event.type) {
					case "note_delta":
						yield { type: "note_delta", data: { text: event.text } };
						break;
					case "find_intentions":
						calls = event.calls;
						break;
					case "present_suggestions": {
						const suggestions = toSuggestions(event.suggestions, found);
						await recordSuggestions(
							database,
							visitorId,
							suggestions.map((suggestion) => suggestion.intentionId),
						);
						yield { type: "suggestions", data: { suggestions } };
						yield { type: "done", data: {} };
						return;
					}
					case "unavailable":
						yield failed;
						return;
				}
			}
			if (!calls || mustPresent) {
				yield failed;
				return;
			}
			const results: FindIntentionsResult[] = [];
			for (const call of calls) {
				const result = await findIntentions(call);
				if (!result) {
					yield failed;
					return;
				}
				results.push(result);
			}
			steps.push(results);
		}
	};
