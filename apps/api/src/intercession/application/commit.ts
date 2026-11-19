import type { Database } from "../../platform/database";
import type { Result } from "../../platform/result";
import {
	findCommittable,
	recordCommitments,
} from "../adapters/persistence/commitment-store";
import type { Commitment } from "../domain/commitment";

type NotSuggested = { kind: "not_suggested"; intentionIds: string[] };

export type Commit = (batch: {
	visitorId: string;
	intentionIds: string[];
}) => Promise<Result<Commitment[], NotSuggested>>;

export const createCommit =
	({ database }: { database: Database }): Commit =>
	async ({ visitorId, intentionIds }) => {
		const requested = [...new Set(intentionIds)];
		const committable = new Map(
			(
				await findCommittable(database, {
					visitorId,
					intentionIds: requested,
				})
			).map((commitment) => [commitment.intentionId, commitment]),
		);
		const notSuggested = requested.filter((id) => !committable.has(id));
		if (notSuggested.length > 0) {
			return {
				ok: false,
				error: { kind: "not_suggested", intentionIds: notSuggested },
			};
		}
		await recordCommitments(database, { visitorId, intentionIds: requested });
		return {
			ok: true,
			value: requested.flatMap((id) => committable.get(id) ?? []),
		};
	};
