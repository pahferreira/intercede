import { createApp } from "./app";
import { createDatabase } from "./platform/database";

const { checkDatabase } = createDatabase();

const server = Bun.serve({
	port: Number(process.env.PORT ?? 3000),
	fetch: createApp({ checkDatabase }).fetch,
});

console.log(`API listening on ${server.url}`);
