import type { Database } from "../../platform/database";
import type { Result } from "../../platform/result";
import {
	markProcessed,
	pendingEvents,
} from "../adapters/persistence/outbox-store";
import type { IntentionEvent } from "../domain/intention-event";

type DispatchIntentionEvent = (
	event: IntentionEvent,
) => Promise<Result<void, unknown>>;

type OutboxDrain = { dispatched: number; pending: number };

type DrainOutbox = (dispatch: DispatchIntentionEvent) => Promise<OutboxDrain>;

export const createDrainOutbox = (database: Database): DrainOutbox => {
	return async (dispatch) => {
		const pending = await pendingEvents(database);
		const heldIntentions = new Set<string>();
		let dispatched = 0;
		for (const { id, event } of pending) {
			const { intentionId } = event.payload;
			if (heldIntentions.has(intentionId)) continue;
			const outcome = await dispatch(event);
			if (!outcome.ok) {
				heldIntentions.add(intentionId);
				continue;
			}
			await markProcessed(database, id);
			dispatched++;
		}
		return { dispatched, pending: pending.length - dispatched };
	};
};
