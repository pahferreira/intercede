import type { Commitment } from "@intercede/api";
import { readStoredJson } from "./stored-json";

const storageKey = "intercede.commitments";

export function rememberCommitments(commitments: Commitment[]) {
	sessionStorage.setItem(storageKey, JSON.stringify(commitments));
}

function isCommitment(value: unknown): value is Commitment {
	const candidate = value as Partial<Commitment> | null;
	return (
		typeof candidate?.intentionId === "string" &&
		typeof candidate.text === "string"
	);
}

export function rememberedCommitments(): Commitment[] {
	const stored = readStoredJson(sessionStorage, storageKey);
	return Array.isArray(stored) ? stored.filter(isCommitment) : [];
}
