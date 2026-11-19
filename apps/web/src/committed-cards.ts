import type { Commitment } from "@intercede/api";

const storageKey = "intercede.committedCards";

export function rememberCommitted(commitments: Commitment[]) {
	sessionStorage.setItem(storageKey, JSON.stringify(commitments));
}

function isCommitment(value: unknown): value is Commitment {
	const candidate = value as Partial<Commitment> | null;
	return (
		typeof candidate?.intentionId === "string" &&
		typeof candidate.text === "string"
	);
}

export function committedCards(): Commitment[] {
	try {
		const stored: unknown = JSON.parse(
			sessionStorage.getItem(storageKey) ?? "[]",
		);
		return Array.isArray(stored) ? stored.filter(isCommitment) : [];
	} catch {
		return [];
	}
}
