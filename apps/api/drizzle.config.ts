import { defineConfig } from "drizzle-kit";
import { localOrConfiguredDatabaseUrl } from "./src/platform/database";

export default defineConfig({
	dialect: "postgresql",
	schema: [
		"./src/platform/schema.ts",
		"./src/*/adapters/persistence/schema.ts",
	],
	out: "./drizzle",
	dbCredentials: {
		url: localOrConfiguredDatabaseUrl(),
	},
});
