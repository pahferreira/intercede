import { useState } from "react";
import { rememberedCommitments } from "../commitments";
import { submittedRecently } from "../submit-gate";

export function useCommittedRoute() {
	const [commitments] = useState(rememberedCommitments);
	const [canAskForPrayer] = useState(() => !submittedRecently());

	return { commitments, canAskForPrayer };
}
