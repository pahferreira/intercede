import { expect, test } from "bun:test";
import type { Embed } from "../../src/intercession";
import { testDatabase } from "../../test/database";
import { evaluateSearchRelevance } from "./evaluate";

const axisOf: Record<string, number> = {
	"For my brother's new job": 0,
	"a new job": 0,
	"Pela saúde da minha mãe": 1,
	"Pela cura da minha avó": 2,
	"saúde da família": 2,
};

const embedsByTopic: Embed = async (text) => {
	return {
		ok: true,
		value: Array.from({ length: 512 }, (_, index) =>
			index === axisOf[text] ? 1 : 0,
		),
	};
};

test("scores recall@5 for each Entry, each Language and overall", async () => {
	const report = await evaluateSearchRelevance(
		{ database: testDatabase(), embed: embedsByTopic },
		{
			catalog: [
				{
					key: "brother-job",
					language: "en",
					text: "For my brother's new job",
				},
				{
					key: "mother-health",
					language: "pt",
					text: "Pela saúde da minha mãe",
				},
				{
					key: "grandma-healing",
					language: "pt",
					text: "Pela cura da minha avó",
				},
			],
			entries: [
				{ text: "a new job", language: "en", relevant: ["brother-job"] },
				{
					text: "saúde da família",
					language: "pt",
					relevant: ["mother-health", "grandma-healing"],
				},
			],
		},
	);

	expect(report.entries).toEqual([
		{ text: "a new job", language: "en", recall: 1, ranked: ["brother-job"] },
		{
			text: "saúde da família",
			language: "pt",
			recall: 0.5,
			ranked: ["grandma-healing"],
		},
	]);
	expect(report.recall).toEqual({ en: 1, pt: 0.5, overall: 0.75 });
});
