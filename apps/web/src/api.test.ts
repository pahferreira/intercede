import { expect, test } from "bun:test";
import { createApiClient } from "./api";

function recordingFetch() {
	const requests: { url: string; init?: RequestInit }[] = [];
	const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		requests.push({ url: String(input), init });
		return Response.json({ status: "ok" });
	};
	return { requests, fetch };
}

test("a request with a body carries the hex SHA-256 of that body, so CloudFront can sign it for the Lambda Function URL", async () => {
	const { requests, fetch } = recordingFetch();

	await createApiClient(fetch).api.intentions.$post({
		json: { text: "May my mother heal" },
	});

	expect(requests).toHaveLength(1);
	const headers = new Headers(requests[0]?.init?.headers);
	expect(headers.get("x-amz-content-sha256")).toBe(
		"cf3d0f883a9c0a06be4a3190622ffc56bcc9316d249bda88606de8c37ac51f12",
	);
	expect(headers.get("content-type")).toBe("application/json");
});

test("a body that cannot be hashed is refused instead of sent unsigned", async () => {
	const { requests, fetch } = recordingFetch();

	const sending = createApiClient(fetch).api.intentions.$post(
		{ json: { text: "May my mother heal" } },
		{ init: { body: new FormData() } },
	);

	expect(sending).rejects.toThrow();
	await sending.catch(() => {});
	expect(requests).toHaveLength(0);
});

test("a request without a body carries no content hash", async () => {
	const { requests, fetch } = recordingFetch();

	await createApiClient(fetch).api.health.$get();

	expect(requests).toHaveLength(1);
	expect(
		new Headers(requests[0]?.init?.headers).has("x-amz-content-sha256"),
	).toBe(false);
});
