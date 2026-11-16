import { join } from "node:path";
import { TransactionRollbackError } from "drizzle-orm/errors";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import {
	createDatabase,
	type Database,
	localOrConfiguredDatabaseUrl,
} from "../src/platform/database";

const testDatabaseName = "intercede_test";

const withDatabaseName = (url: string, name: string) => {
	const parsed = new URL(url);
	parsed.pathname = `/${name}`;
	return parsed.toString();
};

export const testDatabaseUrl = () =>
	withDatabaseName(localOrConfiguredDatabaseUrl(), testDatabaseName);

const quietClient = (url: string, connectTimeoutSeconds: number) =>
	postgres(url, {
		max: 1,
		connect_timeout: connectTimeoutSeconds,
		onnotice: () => {},
	});

const createIfMissing = async (url: string) => {
	const name = new URL(url).pathname.slice(1);
	const admin = quietClient(withDatabaseName(url, "postgres"), 2);
	try {
		await admin`select 1`.catch((cause) => {
			throw new Error(
				`Postgres is unreachable at ${new URL(url).host}: run \`docker compose up -d --wait\``,
				{ cause },
			);
		});
		const [existing] =
			await admin`select 1 from pg_database where datname = ${name}`;
		if (!existing) {
			await admin.unsafe(`create database "${name}"`).catch((error) => {
				if (error?.code !== "42P04") throw error;
			});
		}
	} finally {
		await admin.end();
	}
};

export const prepareTestDatabase = async (url: string) => {
	await createIfMissing(url);
	const client = quietClient(url, 2);
	try {
		await migrate(drizzle({ client }), {
			migrationsFolder: join(import.meta.dir, "../drizzle"),
		});
	} finally {
		await client.end();
	}
};

let connection: ReturnType<typeof createDatabase> | undefined;
let current: { database: Database; rollback: () => Promise<void> } | undefined;

export const connectTestDatabase = (url: string) => {
	connection = createDatabase(url);
};

export const disconnectTestDatabase = async () => {
	await connection?.$client.end();
	connection = undefined;
};

export const beginTestTransaction = async () => {
	if (!connection) throw new Error("the test database is not connected");
	let release = () => {};
	const released = new Promise<void>((resolve) => {
		release = resolve;
	});
	let opened = (_: Database) => {};
	const ready = new Promise<Database>((resolve) => {
		opened = resolve;
	});
	const finished = connection
		.transaction(async (tx) => {
			opened(tx);
			await released;
			tx.rollback();
		})
		.catch((error) => {
			if (!(error instanceof TransactionRollbackError)) throw error;
		});
	const database = await Promise.race([
		ready,
		finished.then(() => {
			throw new Error("the test transaction ended before the test ran");
		}),
	]);
	current = {
		database,
		rollback: async () => {
			release();
			await finished;
			current = undefined;
		},
	};
};

export const rollbackTestTransaction = async () => {
	await current?.rollback();
};

export const testDatabase = () => {
	if (!current) throw new Error("no test transaction is open");
	return current.database;
};
