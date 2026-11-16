import { afterAll, afterEach, beforeEach } from "bun:test";
import {
	beginTestTransaction,
	connectTestDatabase,
	disconnectTestDatabase,
} from "./database";

await connectTestDatabase().catch((error) => {
	console.error(error.message);
	process.exit(1);
});

let rollbackTestTransaction = async () => {};

beforeEach(async () => {
	rollbackTestTransaction = await beginTestTransaction();
});
afterEach(() => rollbackTestTransaction());
afterAll(disconnectTestDatabase);
