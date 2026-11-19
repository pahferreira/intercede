import { lingui } from "@lingui/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { postHogSettings } from "../api/src/platform/analytics";

const { host: postHogHost } = postHogSettings();
const postHogAssetsHost = postHogHost.replace(
	/\.i\.posthog\.com$/,
	"-assets.i.posthog.com",
);

const alwaysPassesTurnstileSiteKey = "1x00000000000000000000AA";

const turnstileSiteKey = (command: "build" | "serve") => {
	const siteKey = process.env.TURNSTILE_SITE_KEY;
	if (siteKey) return siteKey;
	if (command === "build") throw new Error("TURNSTILE_SITE_KEY is not set");
	return alwaysPassesTurnstileSiteKey;
};

export default defineConfig(({ command }) => ({
	plugins: [lingui({ macroTransform: true }), react(), tailwindcss()],
	envPrefix: ["VITE_", "POSTHOG_KEY"],
	define: {
		"import.meta.env.TURNSTILE_SITE_KEY": JSON.stringify(
			turnstileSiteKey(command),
		),
	},
	server: {
		proxy: {
			"/api": `http://localhost:${process.env.API_PORT ?? 3000}`,
			"/ingest/static": {
				target: postHogAssetsHost,
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/ingest/, ""),
			},
			"/ingest": {
				target: postHogHost,
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/ingest/, ""),
			},
		},
	},
}));
