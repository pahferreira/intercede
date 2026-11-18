import type { InferResponseType } from "hono/client";
import type { ApiClient } from "./api";

const codesKey = "intercede.intentionCodes";
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

function intentionCodes(): string[] {
	const codes = readJson(codesKey);
	return Array.isArray(codes)
		? codes.filter((code) => typeof code === "string")
		: [];
}

export function rememberPublished(published: PublishedIntention) {
	localStorage.setItem(
		codesKey,
		JSON.stringify([...intentionCodes(), published.code]),
	);
	localStorage.setItem(noticeKey, JSON.stringify(published));
}

export function publishedNotice(): PublishedIntention | null {
	const notice = readJson(noticeKey) as Partial<PublishedIntention> | null;
	return typeof notice?.code === "string" ? { code: notice.code } : null;
}

export function dismissPublishedNotice() {
	localStorage.removeItem(noticeKey);
}
