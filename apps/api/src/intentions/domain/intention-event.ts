import type { Language } from "./intention";

export const intentionEventTypes = [
	"IntentionPublished",
	"IntentionArchived",
] as const;

export type IntentionEvent =
	| {
			type: "IntentionPublished";
			payload: {
				intentionId: string;
				text: string;
				language: Language;
				publishedAt: string;
			};
	  }
	| { type: "IntentionArchived"; payload: { intentionId: string } };
