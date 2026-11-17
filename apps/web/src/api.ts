import type { AppType } from "@intercede/api";
import { hc } from "hono/client";

type Fetch = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Response | Promise<Response>;

async function sha256Hex(text: string) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(text),
	);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

function withContentHash(fetch: Fetch): Fetch {
	return async (input, init) => {
		if (typeof init?.body !== "string") {
			return fetch(input, init);
		}
		const headers = new Headers(init.headers);
		headers.set("x-amz-content-sha256", await sha256Hex(init.body));
		return fetch(input, { ...init, headers });
	};
}

export function createApiClient(
	fetch: Fetch = (input, init) => globalThis.fetch(input, init),
) {
	return hc<AppType>("/", { fetch: withContentHash(fetch) });
}

export type ApiClient = ReturnType<typeof createApiClient>;
