import type { Database } from "../../platform/database";
import type { Result } from "../../platform/result";
import { findIntentionByCode } from "../adapters/persistence/intention-store";
import type { IntentionStatus } from "../domain/intention";

export type CountCommitments = (intentionId: string) => Promise<number>;

type FollowUp = {
	status: IntentionStatus;
	text: string;
	publishedAt: Date;
	commitments: number;
};

export type FindFollowUp = (
	code: string,
) => Promise<Result<FollowUp, { kind: "not_found" }>>;

type FindFollowUpDeps = {
	database: Database;
	countCommitments: CountCommitments;
};

export const createFindFollowUp = ({
	database,
	countCommitments,
}: FindFollowUpDeps): FindFollowUp => {
	return async (code) => {
		const intention = await findIntentionByCode(database, code);
		if (!intention) return { ok: false, error: { kind: "not_found" } };
		const { id, ...shown } = intention;
		return {
			ok: true,
			value: { ...shown, commitments: await countCommitments(id) },
		};
	};
};
