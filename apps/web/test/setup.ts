import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { linguiPlugin } from "./lingui-plugin";

GlobalRegistrator.register({ url: "http://localhost/" });
Bun.plugin(await linguiPlugin());

const { cleanup } = await import("@testing-library/react");

afterEach(() => {
	cleanup();
	localStorage.clear();
});
