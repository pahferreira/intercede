import { createHmac, timingSafeEqual } from "node:crypto";
import type { Signer } from "./signature-port";

type Env = Record<string, string | undefined>;

export const requireTranscriptKey = (env: Env = process.env) => {
	const key = env.TRANSCRIPT_SIGNING_KEY;
	if (!key) {
		throw new Error("TRANSCRIPT_SIGNING_KEY is not set");
	}
	return key;
};

const lifetimeMs = 15 * 60 * 1000;

type HmacSignerOptions = {
	now?: () => Date;
};

export const createHmacSigner = (
	key: string,
	{ now = () => new Date() }: HmacSignerOptions = {},
): Signer => {
	const macOf = (payload: string, issuedAt: string) => {
		return createHmac("sha256", key)
			.update(`${issuedAt}.${payload}`)
			.digest("base64url");
	};
	return {
		sign: (payload) => {
			const issuedAt = String(now().getTime());
			return `${issuedAt}.${macOf(payload, issuedAt)}`;
		},
		verify: (payload, signature) => {
			const [issuedAt = "", mac = ""] = signature.split(".");
			const age = now().getTime() - Number(issuedAt);
			if (!/^\d+$/.test(issuedAt) || age < 0 || age > lifetimeMs) return false;
			const expected = Buffer.from(macOf(payload, issuedAt));
			const given = Buffer.from(mac);
			return (
				expected.length === given.length && timingSafeEqual(expected, given)
			);
		},
	};
};
