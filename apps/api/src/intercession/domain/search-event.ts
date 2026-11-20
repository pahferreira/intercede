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

export const SearchErrorReason = {
	Internal: "internal",
	InvalidTranscript: "invalid_transcript",
	VerificationFailed: "verification_failed",
	LimitReached: "limit_reached",
} as const;

export type SearchErrorReason =
	(typeof SearchErrorReason)[keyof typeof SearchErrorReason];

export type SearchEvent =
	| { type: "status"; data: { status: "searching" } }
	| { type: "note_delta"; data: { text: string } }
	| {
			type: "suggestions";
			data: {
				match: SuggestionMatch;
				suggestions: Suggestion[];
				signature?: string;
			};
	  }
	| { type: "question"; data: { question: string; signature: string } }
	| { type: "done"; data: Record<string, never> }
	| { type: "error"; data: { reason: SearchErrorReason } };

export const searchError = (reason: SearchErrorReason): SearchEvent => {
	return { type: "error", data: { reason } };
};

export const internalError = searchError(SearchErrorReason.Internal);
