import type { Analytics } from "../../platform/analytics-port";
import type {
	FoundIntention,
	PresentedSuggestion,
} from "../domain/presentation";

export type FindIntentionsCall = { id: string; query: string };

export type FindIntentionsOutcome =
	| { kind: "found"; intentions: FoundIntention[] }
	| { kind: "limit_reached" };

export type FindIntentionsResult = {
	call: FindIntentionsCall;
	outcome: FindIntentionsOutcome;
};

export type AgentEvent =
	| { type: "note_delta"; text: string }
	| { type: "find_intentions"; calls: FindIntentionsCall[] }
	| { type: "present_suggestions"; suggestions: PresentedSuggestion[] }
	| { type: "ask_clarifying_question"; question: string }
	| { type: "unavailable" };

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
