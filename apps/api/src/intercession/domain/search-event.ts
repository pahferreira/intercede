export type Suggestion = {
	intentionId: string;
	text: string;
	whyNote?: string;
};

export const SuggestionMatch = {
	Close: "close",
	Fallback: "fallback",
	EmptyCatalog: "empty_catalog",
} as const;

export type SuggestionMatch =
	(typeof SuggestionMatch)[keyof typeof SuggestionMatch];

export const toMatch = (
	fallback: Suggestion[] | undefined,
): SuggestionMatch => {
	if (fallback === undefined) return SuggestionMatch.Close;
	return fallback.length > 0
		? SuggestionMatch.Fallback
		: SuggestionMatch.EmptyCatalog;
};

export type SearchEvent =
	| { type: "status"; data: { status: "searching" } }
	| { type: "note_delta"; data: { text: string } }
	| {
			type: "suggestions";
			data: { match: SuggestionMatch; suggestions: Suggestion[] };
	  }
	| { type: "question"; data: { question: string } }
	| { type: "done"; data: Record<string, never> }
	| { type: "error"; data: { reason: "internal" } };

export const internalError: SearchEvent = {
	type: "error",
	data: { reason: "internal" },
};
