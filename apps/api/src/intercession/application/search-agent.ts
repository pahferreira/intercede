import type { Analytics } from "../../platform/analytics-port";
import type {
	FoundIntention,
	PresentedSuggestion,
} from "../domain/presentation";

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

export type FindIntentionsCall = { id: string; query: string };

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

export type SearchAgentTurn = {
	entry: string;
	clarification?: Clarification;
	steps: FindIntentionsResult[][];
	mustPresent: boolean;
};

export type SearchAgent = (
	turn: SearchAgentTurn,
	analytics: Analytics,
) => AsyncIterable<AgentEvent>;
