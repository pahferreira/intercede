import { createHash, randomBytes } from "node:crypto";

const tokenBytes = 32;

const hashFollowUpToken = (token: string) =>
	createHash("sha256").update(token).digest("hex");

export const issueFollowUpToken = () => {
	const token = randomBytes(tokenBytes).toString("base64url");
	return { token, hash: hashFollowUpToken(token) };
};
