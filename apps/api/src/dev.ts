import { app } from "./app";

const server = Bun.serve({
	port: Number(process.env.PORT ?? 3000),
	fetch: app.fetch,
});

console.log(`API listening on ${server.url}`);
