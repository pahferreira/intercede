import { join } from "node:path";
import { TransactionRollbackError } from "drizzle-orm/errors";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import {
	createDatabase,
	type Database,
	localOrConfiguredDatabaseUrl,
} from "../src/platform/database";

const testDatabaseName = "intercede_test";
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const duplicateDatabaseCode = "42P04";
const setupConnectTimeoutSeconds = 2;

const requireLocalUrl = (url: string) => {
	const parsed = new URL(url);
	if (!localHosts.has(parsed.hostname.toLowerCase())) {
		throw new Error(
			`refusing to run tests against ${parsed.hostname}: DATABASE_URL must point at localhost, 127.0.0.1 or ::1`,
		);
	}
	return parsed;
};

const withDatabaseName = (url: URL, name: string) => {
	const renamed = new URL(url);
	renamed.pathname = `/${name}`;
	return renamed.toString();
};

export const testDatabaseUrl = (env = process.env) => {
	return withDatabaseName(
		requireLocalUrl(localOrConfiguredDatabaseUrl(env)),
		testDatabaseName,
	);
};

const createSetupDatabase = (url: string) => {
	return createDatabase(url, {
		connectTimeoutSeconds: setupConnectTimeoutSeconds,
		onnotice: () => {},
	});
};

const createIfMissing = async (url: URL) => {
	const name = url.pathname.slice(1);
	const admin = createSetupDatabase(withDatabaseName(url, "postgres")).$client;
	try {
		await admin`select 1`.catch((cause) => {
			throw new Error(
				`Postgres is unreachable at ${url.host}: run \`docker compose up -d --wait\``,
				{ cause },
			);
		});
		const [existing] =
			await admin`select 1 from pg_database where datname = ${name}`;
		if (!existing) {
			await admin.unsafe(`create database "${name}"`).catch((error) => {
				if (error?.code !== duplicateDatabaseCode) throw error;
			});
		}
	} finally {
		await admin.end();
	}
};

export const prepareTestDatabase = async (url: string) => {
	await createIfMissing(requireLocalUrl(url));
	const database = createSetupDatabase(url);
	try {
		await migrate(database, {
			migrationsFolder: join(import.meta.dir, "../drizzle"),
		});
	} finally {
		await database.$client.end();
	}
};

let testConnection: ReturnType<typeof createDatabase> | undefined;
let openTransaction: Database | undefined;

export const connectTestDatabase = async () => {
	const url = testDatabaseUrl();
	await prepareTestDatabase(url);
	testConnection = createDatabase(url);
};

export const disconnectTestDatabase = async () => {
	await testConnection?.$client.end();
	testConnection = undefined;
};

export const beginTestTransaction = async () => {
	if (!testConnection) throw new Error("the test database is not connected");
	const rollbackRequested = Promise.withResolvers<void>();
	const transactionOpened = Promise.withResolvers<Database>();
	const transactionSettled = testConnection
		.transaction(async (tx) => {
			transactionOpened.resolve(tx);
			await rollbackRequested.promise;
			tx.rollback();
		})
		.catch((error) => {
			if (!(error instanceof TransactionRollbackError)) throw error;
		});
	openTransaction = await Promise.race([
		transactionOpened.promise,
		transactionSettled.then(() => {
			throw new Error("the test transaction ended before the test ran");
		}),
	]);
	return async () => {
		rollbackRequested.resolve();
		await transactionSettled;
		openTransaction = undefined;
	};
};

export const testDatabase = () => {
	if (!openTransaction) throw new Error("no test transaction is open");
	return openTransaction;
};
