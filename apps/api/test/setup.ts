import { afterAll, afterEach, beforeEach } from "bun:test";
import {
	beginTestTransaction,
	connectTestDatabase,
	disconnectTestDatabase,
	prepareTestDatabase,
	rollbackTestTransaction,
	testDatabaseUrl,
} from "./database";

const url = testDatabaseUrl();

await prepareTestDatabase(url);
connectTestDatabase(url);

beforeEach(beginTestTransaction);
afterEach(rollbackTestTransaction);
afterAll(disconnectTestDatabase);
