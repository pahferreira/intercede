import { defineConfig } from "@lingui/conf";
import { locales, sourceLocale } from "./src/i18n";

export default defineConfig({
	sourceLocale,
	locales: [...locales],
	catalogs: [
		{
			path: "<rootDir>/src/locales/{locale}/messages",
			include: ["src"],
		},
	],
});
