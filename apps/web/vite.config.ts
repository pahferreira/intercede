import { lingui } from "@lingui/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { postHogSettings } from "../api/src/platform/analytics";

const { host: postHogHost } = postHogSettings();

export default defineConfig({
	plugins: [lingui({ macroTransform: true }), react(), tailwindcss()],
	envPrefix: ["VITE_", "POSTHOG_KEY"],
	server: {
		proxy: {
			"/api": `http://localhost:${process.env.API_PORT ?? 3000}`,
			"/ingest": {
				target: postHogHost,
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/ingest/, ""),
			},
		},
	},
});
