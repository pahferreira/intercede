import { randomInt } from "node:crypto";

const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const codeLength = 5;

export const issueIntentionCode = () => {
	return `INT-${Array.from({ length: codeLength }, () => alphabet[randomInt(alphabet.length)]).join("")}`;
};
