import type { InferResponseType } from "hono/client";
import type { ApiClient } from "./api";

const tokensKey = "intercede.followUpTokens";
const noticeKey = "intercede.publishedNotice";

export type PublishedIntention = Omit<
	InferResponseType<ApiClient["api"]["intentions"]["$post"], 201>,
	"status"
>;

function readJson(key: string): unknown {
	try {
		return JSON.parse(localStorage.getItem(key) ?? "null");
	} catch {
		return null;
	}
}

function followUpTokens(): string[] {
	const tokens = readJson(tokensKey);
	return Array.isArray(tokens)
		? tokens.filter((token) => typeof token === "string")
		: [];
}

export function rememberPublished(published: PublishedIntention) {
	localStorage.setItem(
		tokensKey,
		JSON.stringify([...followUpTokens(), published.followUpToken]),
	);
	localStorage.setItem(noticeKey, JSON.stringify(published));
}

export function publishedNotice(): PublishedIntention | null {
	const notice = readJson(noticeKey) as Partial<PublishedIntention> | null;
	return typeof notice?.followUpToken === "string" &&
		typeof notice.code === "string"
		? { followUpToken: notice.followUpToken, code: notice.code }
		: null;
}

export function dismissPublishedNotice() {
	localStorage.removeItem(noticeKey);
}
