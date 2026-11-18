import type { SearchEvent } from "@intercede/api";

function parseEvent(block: string): SearchEvent | null {
	let type = "";
	const data: string[] = [];
	for (const line of block.split("\n")) {
		if (line.startsWith("event:")) {
			type = line.slice("event:".length).trim();
		} else if (line.startsWith("data:")) {
			data.push(line.slice("data:".length).trimStart());
		}
	}
	if (!type || data.length === 0) {
		return null;
	}
	return { type, data: JSON.parse(data.join("\n")) } as SearchEvent;
}

export async function* readSearchEvents(
	body: ReadableStream<Uint8Array>,
): AsyncGenerator<SearchEvent> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffered = "";
	while (true) {
		const { value, done } = await reader.read();
		if (done) {
			return;
		}
		buffered += decoder
			.decode(value, { stream: true })
			.replaceAll("\r\n", "\n");
		const blocks = buffered.split("\n\n");
		buffered = blocks.pop() ?? "";
		for (const block of blocks) {
			const event = parseEvent(block);
			if (event) {
				yield event;
			}
		}
	}
}
