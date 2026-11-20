import type { Language } from "../../intentions";
import type { Analytics } from "../../platform/analytics-port";
import type {
	FoundIntention,
	PresentedSuggestion,
} from "../domain/presentation";
import type { Suggestion } from "../domain/search-event";

export const ToolName = {
	FindIntentions: "find_intentions",
	PresentSuggestions: "present_suggestions",
	AskClarifyingQuestion: "ask_clarifying_question",
} as const;

export type ToolName = (typeof ToolName)[keyof typeof ToolName];

export const AgentEventType = {
	...ToolName,
	NoteDelta: "note_delta",
	Unavailable: "unavailable",
} as const;

export type FindIntentionsCall = {
	id: string;
	query: string;
	language: Language;
};

export type FindIntentionsOutcome =
	| { kind: "found"; intentions: FoundIntention[] }
	| { kind: "limit_reached" };

export type FindIntentionsResult = {
	call: FindIntentionsCall;
	outcome: FindIntentionsOutcome;
};

export type AgentEvent =
	| { type: typeof AgentEventType.NoteDelta; text: string }
	| { type: typeof AgentEventType.FindIntentions; calls: FindIntentionsCall[] }
	| {
			type: typeof AgentEventType.PresentSuggestions;
			suggestions: PresentedSuggestion[];
	  }
	| { type: typeof AgentEventType.AskClarifyingQuestion; question: string }
	| { type: typeof AgentEventType.Unavailable };

export type Clarification = { question: string; answer: string };

export type TranscriptTurn = {
	entry: string;
	clarification?: Clarification;
	note: string;
	suggestions: Suggestion[];
};

export type SearchAgentTurn = {
	transcript: TranscriptTurn[];
	entry: string;
	clarification?: Clarification;
	steps: FindIntentionsResult[][];
	mustPresent: boolean;
};

export const canAskClarifyingQuestion = ({
	transcript,
	clarification,
}: Pick<SearchAgentTurn, "transcript" | "clarification">) => {
	return clarification === undefined && transcript.length === 0;
};

export type SearchAgent = (
	turn: SearchAgentTurn,
	analytics: Analytics,
) => AsyncIterable<AgentEvent>;
