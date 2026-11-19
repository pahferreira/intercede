export const maxCommitmentsPerBatch = 20;

export type Commitment = { intentionId: string; text: string };

export type CommitmentBatch = { visitorId: string; intentionIds: string[] };
