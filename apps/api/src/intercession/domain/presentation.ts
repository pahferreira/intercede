import type { Suggestion } from "./search-event";

export const maxFindIntentionsCalls = 3;
export const maxSuggestions = 5;
export const suggestionWindowHours = 24;

export type FoundIntention = { intentionId: string; text: string };

export type PresentedSuggestion = { intentionId: string; whyNote: string };

export const toSuggestions = (
	presented: PresentedSuggestion[],
	found: FoundIntention[],
): Suggestion[] => {
	const textById = new Map(
		found.map((intention) => [intention.intentionId, intention.text]),
	);
	const suggestions = new Map<string, Suggestion>();
	for (const { intentionId, whyNote } of presented) {
		const text = textById.get(intentionId);
		if (text === undefined || suggestions.has(intentionId)) continue;
		suggestions.set(intentionId, { intentionId, text, whyNote });
	}
	return [...suggestions.values()].slice(0, maxSuggestions);
};
