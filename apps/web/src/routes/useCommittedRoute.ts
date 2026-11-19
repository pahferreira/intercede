import { useState } from "react";
import { committedCards } from "../committed-cards";
import { submittedRecently } from "../submit-gate";

export function useCommittedRoute() {
	const [commitments] = useState(committedCards);
	const [canAskForPrayer] = useState(() => !submittedRecently());

	return { commitments, canAskForPrayer };
}
