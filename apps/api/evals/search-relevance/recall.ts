export const recallAt = (k: number, ranked: string[], relevant: string[]) => {
	const top = new Set(ranked.slice(0, k));
	return relevant.filter((key) => top.has(key)).length / relevant.length;
};
