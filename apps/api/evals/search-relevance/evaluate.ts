import { type Language, languages } from "../../src/intentions";
import {
	createFindIntentions,
	createKeepCatalogInStep,
	type Embed,
} from "../../src/intercession";
import type { Analytics } from "../../src/platform/analytics-port";
import type { Database } from "../../src/platform/database";
import { recallAt } from "./recall";

const k = 5;

export type CatalogIntention = {
	key: string;
	language: Language;
	text: string;
};

export type EvalEntry = {
	text: string;
	language: Language;
	relevant: string[];
};

type EvalSet = { catalog: CatalogIntention[]; entries: EvalEntry[] };

type EntryScore = {
	text: string;
	language: Language;
	recall: number;
	ranked: string[];
};

type RelevanceReport = {
	entries: EntryScore[];
	recall: Record<Language | "overall", number>;
};

type EvaluateDeps = { database: Database; embed: Embed };

const noAnalytics: Analytics = {
	captureException: () => {},
	captureLlmGeneration: () => {},
	shutdown: async () => {},
};

const mean = (values: number[]) => {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const evaluateSearchRelevance = async (
	{ database, embed }: EvaluateDeps,
	{ catalog, entries }: EvalSet,
): Promise<RelevanceReport> => {
	const keepCatalogInStep = createKeepCatalogInStep({ database, embed });
	const findIntentions = createFindIntentions({ database, embed });
	const keyById = new Map<string, string>();
	for (const { key, language, text } of catalog) {
		const intentionId = Bun.randomUUIDv7();
		keyById.set(intentionId, key);
		const published = await keepCatalogInStep(
			{
				type: "IntentionPublished",
				payload: {
					intentionId,
					text,
					language,
					publishedAt: new Date().toISOString(),
				},
			},
			noAnalytics,
		);
		if (!published.ok) throw new Error(`could not embed "${key}"`);
	}

	const visitorId = Bun.randomUUIDv7();
	const scores: EntryScore[] = [];
	for (const { text, language, relevant } of entries) {
		const found = await findIntentions(
			{ query: text, language, visitorId },
			noAnalytics,
		);
		if (!found.ok) throw new Error(`could not embed the Entry "${text}"`);
		const ranked = found.value
			.slice(0, k)
			.map(({ intentionId }) => keyById.get(intentionId) ?? intentionId);
		scores.push({
			text,
			language,
			recall: recallAt(k, ranked, relevant),
			ranked,
		});
	}

	const recallIn = (language: Language) => {
		return mean(
			scores
				.filter((score) => score.language === language)
				.map((score) => score.recall),
		);
	};
	return {
		entries: scores,
		recall: {
			...(Object.fromEntries(
				languages.map((language) => [language, recallIn(language)]),
			) as Record<Language, number>),
			overall: mean(scores.map((score) => score.recall)),
		},
	};
};
