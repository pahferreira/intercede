const submittedOrSkippedKey = "intercede.submittedOrSkippedAt";
const submittedKey = "intercede.submittedAt";
const gateMs = 24 * 60 * 60 * 1000;

function rememberedRecently(key: string, now: number) {
	const at = Number(localStorage.getItem(key) ?? Number.NaN);
	return Number.isFinite(at) && now - at < gateMs;
}

export function rememberSubmitOrSkip(now = Date.now()) {
	localStorage.setItem(submittedOrSkippedKey, String(now));
}

export function rememberSubmitted(now = Date.now()) {
	localStorage.setItem(submittedKey, String(now));
}

export function submittedOrSkippedRecently(now = Date.now()) {
	return rememberedRecently(submittedOrSkippedKey, now);
}

export function submittedRecently(now = Date.now()) {
	return rememberedRecently(submittedKey, now);
}
