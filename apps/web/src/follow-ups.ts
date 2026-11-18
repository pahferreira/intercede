const tokensKey = "intercede.followUpTokens";
const noticeKey = "intercede.publishedNotice";

export type PublishedIntention = { followUpToken: string; label: string };

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
		typeof notice.label === "string"
		? { followUpToken: notice.followUpToken, label: notice.label }
		: null;
}

export function dismissPublishedNotice() {
	localStorage.removeItem(noticeKey);
}

export function followUpUrl(followUpToken: string, origin = location.origin) {
	return new URL(`/f/${followUpToken}`, origin).href;
}
