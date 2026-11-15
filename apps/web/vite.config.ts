import { lingui } from "@lingui/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [lingui({ macroTransform: true }), react(), tailwindcss()],
	server: {
		proxy: {
			"/api": `http://localhost:${process.env.API_PORT ?? 3000}`,
		},
	},
});
