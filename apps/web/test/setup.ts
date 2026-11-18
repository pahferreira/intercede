import { afterEach, beforeEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { linguiPlugin } from "./lingui-plugin";
import { installTurnstile } from "./turnstile";

GlobalRegistrator.register({ url: "http://localhost/" });
Bun.plugin(await linguiPlugin());

const { cleanup } = await import("@testing-library/react");

beforeEach(() => {
	installTurnstile();
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});
