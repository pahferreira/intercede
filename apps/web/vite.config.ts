import { lingui } from "@lingui/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [lingui({ macroTransform: true }), react(), tailwindcss()],
	envPrefix: ["VITE_", "POSTHOG_KEY"],
	server: {
		proxy: {
			"/api": `http://localhost:${process.env.API_PORT ?? 3000}`,
			"/ingest": {
				target: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/ingest/, ""),
			},
		},
	},
});
