import type { VerifyTurnstile } from "./turnstile-port";

const siteverifyUrl =
	"https://challenges.cloudflare.com/turnstile/v0/siteverify";
const timeoutMs = 5_000;

type Env = Record<string, string | undefined>;

type Fetch = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

export const requireTurnstileSecret = (env: Env = process.env) => {
	const secret = env.TURNSTILE_SECRET_KEY;
	if (!secret) {
		throw new Error("TURNSTILE_SECRET_KEY is not set");
	}
	return secret;
};

type TurnstileVerifierOptions = {
	secret: string;
	fetch?: Fetch;
};

export const createTurnstileVerifier = ({
	secret,
	fetch = globalThis.fetch,
}: TurnstileVerifierOptions): VerifyTurnstile => {
	return async (token) => {
		try {
			const response = await fetch(siteverifyUrl, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ secret, response: token }),
				signal: AbortSignal.timeout(timeoutMs),
			});
			if (!response.ok) return false;
			const outcome = (await response.json()) as { success?: unknown };
			return outcome.success === true;
		} catch {
			return false;
		}
	};
};
