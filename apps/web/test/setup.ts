import { afterEach, beforeEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { linguiPlugin } from "./lingui-plugin";
import { installTurnstile } from "./turnstile";

const { TransformStream, WritableStream } = globalThis;
GlobalRegistrator.register({ url: "http://localhost/" });
// happy-dom swaps these web streams for Node streams, which Hono's streamSSE cannot write to.
Object.assign(globalThis, { TransformStream, WritableStream });
Bun.plugin(await linguiPlugin());

const { cleanup } = await import("@testing-library/react");

beforeEach(() => {
	installTurnstile();
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});
