import { cosineDistance, eq } from "drizzle-orm";
import type { Language } from "../../../intentions";
import type { Database } from "../../../platform/database";
import { catalog } from "./schema";

export const putInCatalog = async (
	database: Database,
	entry: {
		intentionId: string;
		text: string;
		language: Language;
		embedding: number[];
	},
) => {
	const { intentionId, ...rest } = entry;
	await database
		.insert(catalog)
		.values(entry)
		.onConflictDoUpdate({ target: catalog.intentionId, set: rest });
};

export const removeFromCatalog = async (
	database: Database,
	intentionId: string,
) => {
	await database.delete(catalog).where(eq(catalog.intentionId, intentionId));
};

const intentionsPerSearch = 10;

export const findNearestInCatalog = (database: Database, embedding: number[]) =>
	database
		.select({ intentionId: catalog.intentionId, text: catalog.text })
		.from(catalog)
		.orderBy(cosineDistance(catalog.embedding, embedding))
		.limit(intentionsPerSearch);
