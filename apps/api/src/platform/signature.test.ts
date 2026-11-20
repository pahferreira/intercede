import { expect, test } from "bun:test";
import { requireTranscriptKey } from "./signature";

test("requireTranscriptKey reads TRANSCRIPT_SIGNING_KEY", () => {
	expect(requireTranscriptKey({ TRANSCRIPT_SIGNING_KEY: "key" })).toBe("key");
});

test("requireTranscriptKey throws when TRANSCRIPT_SIGNING_KEY is unset", () => {
	expect(() => requireTranscriptKey({})).toThrow("TRANSCRIPT_SIGNING_KEY");
});
