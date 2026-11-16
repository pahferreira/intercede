const storageKey = "intercede.submittedOrSkippedAt";
const gateMs = 24 * 60 * 60 * 1000;

export function rememberSubmitOrSkip(now = Date.now()) {
	localStorage.setItem(storageKey, String(now));
}

export function submittedOrSkippedRecently(now = Date.now()) {
	const at = Number(localStorage.getItem(storageKey) ?? Number.NaN);
	return Number.isFinite(at) && now - at < gateMs;
}
