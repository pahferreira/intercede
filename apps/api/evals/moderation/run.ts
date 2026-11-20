import {
	createAnthropicModerator,
	createNovaModerator,
	languages,
	type Moderate,
	rejectionReasons,
} from "../../src/intentions";
import type { Analytics } from "../../src/platform/analytics-port";
import { type LabelledIntention, labelledIntentions } from "./intentions";
import { flagged, type ScoredVerdict, score } from "./score";

const moderators = {
	nova: createNovaModerator,
	anthropic: createAnthropicModerator,
};

const moderatorName = process.argv[2] ?? "nova";
if (!(moderatorName in moderators)) {
	console.error(
		`Unknown moderator "${moderatorName}". Use one of: ${Object.keys(moderators).join(", ")}.`,
	);
	process.exit(1);
}
const moderate: Moderate =
	moderators[moderatorName as keyof typeof moderators]();

const exceptions: unknown[] = [];
const analytics: Analytics = {
	captureException: (error) => {
		exceptions.push(error);
	},
	captureLlmGeneration: () => {},
	shutdown: async () => {},
};

type Judged = ScoredVerdict & { intention: LabelledIntention };

const concurrency = 4;
const judged: Judged[] = [];
const unavailable: LabelledIntention[] = [];
const queue = [...labelledIntentions];

const work = async () => {
	for (let intention = queue.shift(); intention; intention = queue.shift()) {
		const result = await moderate(intention.text, analytics);
		if (result.ok) {
			judged.push({
				intention,
				labelled: intention.reasons,
				verdict: result.value,
			});
		} else {
			unavailable.push(intention);
		}
	}
};

console.log(
	`Moderating ${labelledIntentions.length} labelled intentions with ${moderatorName}…\n`,
);
await Promise.all(Array.from({ length: concurrency }, work));

const percent = (value: number | null) => {
	return value === null ? "n/a" : `${(value * 100).toFixed(0)}%`;
};

const printScores = (title: string, verdicts: Judged[]) => {
	const scores = score(verdicts);
	console.log(title);
	console.table(
		Object.fromEntries(
			rejectionReasons.map((reason) => {
				const { precision, recall } = scores[reason];
				return [
					reason,
					{
						labelled: verdicts.filter((v) => v.labelled.includes(reason))
							.length,
						precision: percent(precision),
						recall: percent(recall),
					},
				];
			}),
		),
	);
};

printScores("All languages", judged);
for (const language of languages) {
	printScores(
		language,
		judged.filter(({ intention }) => intention.language === language),
	);
}

const mismatches = judged.filter(
	(entry) =>
		[...entry.labelled].sort().join() !==
		[...flagged(entry.verdict)].sort().join(),
);
if (mismatches.length > 0) {
	console.log(`\n${mismatches.length} mismatched verdicts:`);
	for (const entry of mismatches) {
		console.log(
			`- [${entry.intention.language}] labelled [${entry.labelled.join(", ")}], flagged [${flagged(entry.verdict).join(", ")}]: ${entry.intention.text}`,
		);
	}
}

if (unavailable.length > 0) {
	console.log(
		`\nModeration was unavailable for ${unavailable.length} intentions; they are left out of the scores:`,
	);
	for (const intention of unavailable) {
		console.log(`- [${intention.language}] ${intention.text}`);
	}
	console.error(exceptions[0]);
}
