import { expect, test } from "bun:test";
import { createTurnstileVerifier, requireTurnstileSecret } from "./turnstile";

const siteverify = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function fakeSiteverify(answer: () => Response) {
	const requests: { url: string; body: unknown }[] = [];
	const fetch = async (input: string | URL | Request, init?: RequestInit) => {
		requests.push({
			url: String(input),
			body: JSON.parse(String(init?.body)),
		});
		return answer();
	};
	return { requests, fetch };
}

test("a token Cloudflare accepts passes, checked with the secret", async () => {
	const cloudflare = fakeSiteverify(() => Response.json({ success: true }));
	const verify = createTurnstileVerifier({
		secret: "turnstile-secret",
		fetch: cloudflare.fetch,
	});

	expect(await verify("turnstile-token")).toBe(true);
	expect(cloudflare.requests).toEqual([
		{
			url: siteverify,
			body: { secret: "turnstile-secret", response: "turnstile-token" },
		},
	]);
});

test("a token Cloudflare refuses fails", async () => {
	const cloudflare = fakeSiteverify(() =>
		Response.json({
			success: false,
			"error-codes": ["invalid-input-response"],
		}),
	);
	const verify = createTurnstileVerifier({
		secret: "turnstile-secret",
		fetch: cloudflare.fetch,
	});

	expect(await verify("turnstile-token")).toBe(false);
});

test.each([
	["answers with an error", () => new Response("bad gateway", { status: 502 })],
	[
		"is unreachable",
		() => {
			throw new TypeError("fetch failed");
		},
	],
])("a check fails when Cloudflare %s", async (_, answer) => {
	const cloudflare = fakeSiteverify(answer);
	const verify = createTurnstileVerifier({
		secret: "turnstile-secret",
		fetch: cloudflare.fetch,
	});

	expect(await verify("turnstile-token")).toBe(false);
});

test("requireTurnstileSecret reads TURNSTILE_SECRET_KEY", () => {
	expect(requireTurnstileSecret({ TURNSTILE_SECRET_KEY: "secret" })).toBe(
		"secret",
	);
});

test("requireTurnstileSecret throws when TURNSTILE_SECRET_KEY is unset", () => {
	expect(() => requireTurnstileSecret({})).toThrow("TURNSTILE_SECRET_KEY");
});
