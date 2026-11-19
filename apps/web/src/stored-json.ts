export function readStoredJson(storage: Storage, key: string): unknown {
	try {
		return JSON.parse(storage.getItem(key) ?? "null");
	} catch {
		return null;
	}
}
