import { asc, eq, isNull } from "drizzle-orm";
import type { Database } from "../../../platform/database";
import type { IntentionEvent } from "../../domain/intention-event";
import { outbox } from "./schema";

type PendingEvent = { id: string; event: IntentionEvent };

export const pendingEvents = async (
	database: Database,
): Promise<PendingEvent[]> => {
	const rows = await database
		.select()
		.from(outbox)
		.where(isNull(outbox.processedAt))
		.orderBy(asc(outbox.occurredAt), asc(outbox.id));
	return rows.map((row) => ({
		id: row.id,
		event: { type: row.type, payload: row.payload } as IntentionEvent,
	}));
};

export const markProcessed = async (database: Database, id: string) => {
	await database
		.update(outbox)
		.set({ processedAt: new Date() })
		.where(eq(outbox.id, id));
};
