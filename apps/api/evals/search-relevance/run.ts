import { createTitanEmbedder } from "../../src/intercession";
import {
	beginTestTransaction,
	connectTestDatabase,
	disconnectTestDatabase,
	testDatabase,
} from "../../test/database";
import { catalog } from "./catalog";
import { entries } from "./entries";
import { evaluateSearchRelevance } from "./evaluate";

const percent = (recall: number) => `${(recall * 100).toFixed(0)}%`.padStart(4);

await connectTestDatabase();
const rollback = await beginTestTransaction();
try {
	const report = await evaluateSearchRelevance(
		{ database: testDatabase(), embed: createTitanEmbedder() },
		{ catalog, entries },
	);
	for (const { text, language, recall, ranked } of report.entries) {
		console.log(`${percent(recall)}  ${language}  ${text}`);
		if (recall < 1)
			console.log(`            ranked: ${ranked.join(", ") || "nothing"}`);
	}
	console.log("\nrecall@5");
	for (const [scope, recall] of Object.entries(report.recall)) {
		console.log(`  ${scope.padEnd(8)}${percent(recall)}`);
	}
} finally {
	await rollback();
	await disconnectTestDatabase();
}
