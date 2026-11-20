export type TokenBudget = {
	isSpent: () => Promise<boolean>;
	spend: (tokens: number) => Promise<void>;
};
