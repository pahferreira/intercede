import type { FoundIntention } from "./presentation";

const minimumSimilarity = 0.25;
const alreadySuggestedPenalty = 0.15;
const intentionsPerSearch = 10;
export const candidatesPerSearch = intentionsPerSearch * 3;

export type Candidate = FoundIntention & {
	similarity: number;
	alreadySuggested: boolean;
};

const score = (candidate: Candidate) =>
	candidate.similarity -
	(candidate.alreadySuggested ? alreadySuggestedPenalty : 0);

export const rank = (candidates: Candidate[]): FoundIntention[] =>
	candidates
		.filter((candidate) => candidate.similarity >= minimumSimilarity)
		.toSorted((a, b) => score(b) - score(a))
		.slice(0, intentionsPerSearch)
		.map(({ intentionId, text }) => ({ intentionId, text }));
