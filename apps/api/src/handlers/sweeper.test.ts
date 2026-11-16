import { expect, spyOn, test } from "bun:test";
import { handler } from "./sweeper";

test("each scheduled run logs one no-op tick", async () => {
	const info = spyOn(console, "info").mockImplementation(() => {});

	try {
		await handler();

		expect(info).toHaveBeenCalledTimes(1);
		expect(info).toHaveBeenCalledWith("sweeper tick: nothing to sweep");
	} finally {
		info.mockRestore();
	}
});
