import { expect, test } from "bun:test";
import { readSearchEvents } from "./search-stream";

function bodyOf(chunks: string[]) {
	const encoder = new TextEncoder();
	return new ReadableStream<Uint8Array>({
		start: (controller) => {
			for (const chunk of chunks) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		},
	});
}

test("reads events split across chunks, in order", async () => {
	const events = await Array.fromAsync(
		readSearchEvents(
			bodyOf([
				'event: note_delta\ndata: {"te',
				'xt":"Hello"}\n\nevent: done\r\n',
				"data: {}\r\n\r\n",
			]),
		),
	);

	expect(events).toEqual([
		{ type: "note_delta", data: { text: "Hello" } },
		{ type: "done", data: {} },
	]);
});
