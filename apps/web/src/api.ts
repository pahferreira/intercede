import type { AppType } from "@intercede/api";
import { type ClientRequestOptions, hc } from "hono/client";

export function createApiClient(fetch?: ClientRequestOptions["fetch"]) {
	return hc<AppType>("/", { fetch });
}

export type ApiClient = ReturnType<typeof createApiClient>;
