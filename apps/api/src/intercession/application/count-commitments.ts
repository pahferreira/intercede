import type { Database } from "../../platform/database";
import { countCommittedVisitors } from "../adapters/persistence/commitment-store";

type CountCommitmentsDeps = { database: Database };

export const createCountCommitments = ({ database }: CountCommitmentsDeps) => {
	return (intentionId: string) => {
		return countCommittedVisitors(database, intentionId);
	};
};
