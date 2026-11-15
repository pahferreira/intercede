import { defineConfig } from "@lingui/conf";

export default defineConfig({
	sourceLocale: "en",
	locales: ["en", "pt-BR"],
	catalogs: [
		{
			path: "<rootDir>/src/locales/{locale}/messages",
			include: ["src"],
		},
	],
});
