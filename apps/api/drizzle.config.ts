import { defineConfig } from "drizzle-kit";
import { localDatabaseUrl } from "./src/platform/database";

export default defineConfig({
	dialect: "postgresql",
	schema: [
		"./src/platform/schema.ts",
		"./src/*/adapters/persistence/schema.ts",
	],
	out: "./drizzle",
	dbCredentials: {
		url: process.env.DATABASE_URL ?? localDatabaseUrl,
	},
});
