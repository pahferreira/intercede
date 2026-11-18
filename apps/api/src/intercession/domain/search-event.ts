export type Suggestion = {
	intentionId: string;
	text: string;
	whyNote: string;
};

export type SearchEvent =
	| { type: "status"; data: { status: "searching" } }
	| { type: "note_delta"; data: { text: string } }
	| { type: "suggestions"; data: { suggestions: Suggestion[] } }
	| { type: "done"; data: Record<string, never> }
	| { type: "error"; data: { reason: "internal" } };

export const internalError: SearchEvent = {
	type: "error",
	data: { reason: "internal" },
};
