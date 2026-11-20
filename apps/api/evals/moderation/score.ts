import {
	type ModerationVerdict,
	type RejectionReason,
	rejectionReasons,
} from "../../src/intentions";

export type ScoredVerdict = {
	labelled: RejectionReason[];
	verdict: ModerationVerdict;
};

export type ReasonScore = { precision: number | null; recall: number | null };

const ratio = (part: number, whole: number) => {
	return whole === 0 ? null : part / whole;
};

export const flagged = (verdict: ModerationVerdict) => {
	return verdict.publishable ? [] : verdict.reasons;
};

export const score = (verdicts: ScoredVerdict[]) => {
	return Object.fromEntries(
		rejectionReasons.map((reason) => {
			let truePositives = 0;
			let falsePositives = 0;
			let falseNegatives = 0;
			for (const { labelled, verdict } of verdicts) {
				const expected = labelled.includes(reason);
				const predicted = flagged(verdict).includes(reason);
				if (expected && predicted) truePositives++;
				if (!expected && predicted) falsePositives++;
				if (expected && !predicted) falseNegatives++;
			}
			return [
				reason,
				{
					precision: ratio(truePositives, truePositives + falsePositives),
					recall: ratio(truePositives, truePositives + falseNegatives),
				},
			];
		}),
	) as Record<RejectionReason, ReasonScore>;
};
