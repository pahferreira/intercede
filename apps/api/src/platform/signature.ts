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

export const createHmacSigner = (key: string): Signer => {
	const sign = (payload: string) => {
		return createHmac("sha256", key).update(payload).digest("base64url");
	};
	return {
		sign,
		verify: (payload, signature) => {
			const expected = Buffer.from(sign(payload));
			const given = Buffer.from(signature);
			return (
				expected.length === given.length && timingSafeEqual(expected, given)
			);
		},
	};
};
