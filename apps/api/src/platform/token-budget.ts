import type { Database } from "./database";
import {
	addToCounter,
	positiveIntegerSetting,
	readCounter,
} from "./rate-limit";
import type { TokenBudget } from "./token-budget-port";

type Env = Record<string, string | undefined>;

const everyone = "everyone";

export const searchTokensPerDay = (env: Env = process.env) => {
	return positiveIntegerSetting(env, "SEARCH_TOKENS_PER_DAY", 2_000_000);
};

type DailyTokenBudgetOptions = {
	limit: number;
	now?: () => Date;
};

export const createDailyTokenBudget = (
	database: Database,
	{ limit, now }: DailyTokenBudgetOptions,
): TokenBudget => {
	const counter = { action: "search_tokens", per: "day", now } as const;
	return {
		isSpent: async () => {
			return (await readCounter(database, counter, everyone)) >= limit;
		},
		spend: async (tokens) => {
			await addToCounter(database, counter, everyone, tokens);
		},
	};
};

export const createSearchTokenBudget = (
	database: Database,
	env: Env = process.env,
) => {
	return createDailyTokenBudget(database, { limit: searchTokensPerDay(env) });
};
