import { afterEach, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "../../..");
const depcruise = join(repoRoot, "node_modules/.bin/depcruise");
const config = join(repoRoot, ".dependency-cruiser.cjs");

type CruiseOutput = {
	summary: {
		totalCruised: number;
		violations: { rule: { name: string } }[];
	};
};

const cruise = (cwd: string) => {
	const { stdout } = Bun.spawnSync(
		[depcruise, "apps/api/src", "--config", config, "--output-type", "json"],
		{ cwd },
	);
	const { summary } = JSON.parse(stdout.toString()) as CruiseOutput;
	return {
		cruised: summary.totalCruised,
		rules: summary.violations.map((violation) => violation.rule.name).sort(),
	};
};

const fixtures: string[] = [];

afterEach(() => {
	for (const fixture of fixtures.splice(0)) {
		rmSync(fixture, { recursive: true, force: true });
	}
});

const cruiseFixture = (files: Record<string, string>) => {
	const root = mkdtempSync(join(tmpdir(), "boundaries-"));
	fixtures.push(root);
	mkdirSync(join(root, "apps/api"), { recursive: true });
	writeFileSync(join(root, "apps/api/tsconfig.json"), "{}");
	symlinkSync(
		join(repoRoot, "apps/api/node_modules"),
		join(root, "apps/api/node_modules"),
	);
	for (const [path, source] of Object.entries(files)) {
		const file = join(root, "apps/api/src", path);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, source);
	}
	return cruise(root);
};

const intentionRepository = {
	"intentions/adapters/persistence/intention-repository.ts":
		"export const intentionRepository = {};",
};

test("the real source tree is cruised and has no violations", () => {
	const { cruised, rules } = cruise(repoRoot);

	expect(cruised).toBeGreaterThan(0);
	expect(rules).toEqual([]);
});

test("a context reaching past another context's index.ts is rejected", () => {
	const { rules } = cruiseFixture({
		"intentions/domain/intention.ts": "export type Intention = { id: string };",
		"intercession/application/mirror.ts":
			'import type { Intention } from "../../intentions/domain/intention";\nexport type Mirror = Intention;',
	});

	expect(rules).toEqual(["context-via-index"]);
});

test("a context importing another context's index.ts is allowed", () => {
	const { rules } = cruiseFixture({
		"intentions/domain/intention.ts": "export type Intention = { id: string };",
		"intentions/index.ts":
			'export type { Intention } from "./domain/intention";',
		"intercession/application/mirror.ts":
			'import type { Intention } from "../../intentions";\nexport type Mirror = Intention;',
	});

	expect(rules).toEqual([]);
});

test("domain importing adapters is rejected", () => {
	const { rules } = cruiseFixture({
		...intentionRepository,
		"intentions/domain/leak.ts":
			'import { intentionRepository } from "../adapters/persistence/intention-repository";\nexport const leak = intentionRepository;',
	});

	expect(rules).toEqual(["domain-not-adapters"]);
});

test("domain importing a framework is rejected", () => {
	const { rules } = cruiseFixture({
		"intentions/domain/leak.ts":
			'import type { Context } from "hono";\nexport type Leak = Context;',
	});

	expect(rules).toEqual(["domain-no-framework"]);
});

test("domain importing a platform implementation is rejected", () => {
	const { rules } = cruiseFixture({
		"platform/database.ts": "export const database = {};",
		"intentions/domain/leak.ts":
			'import { database } from "../../platform/database";\nexport const leak = database;',
	});

	expect(rules).toEqual(["domain-platform-result-only"]);
});

test("domain importing platform/result.ts is allowed", () => {
	const { rules } = cruiseFixture({
		"platform/result.ts":
			"export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };",
		"intentions/domain/outcome.ts":
			'import type { Result } from "../../platform/result";\nexport type Outcome = Result<string, string>;',
	});

	expect(rules).toEqual([]);
});

test("a context importing another context's persistence is rejected", () => {
	const { rules } = cruiseFixture({
		...intentionRepository,
		"intercession/application/leak.ts":
			'import { intentionRepository } from "../../intentions/adapters/persistence/intention-repository";\nexport const leak = intentionRepository;',
	});

	expect(rules).toEqual(["context-via-index", "no-foreign-persistence"]);
});

test("an index.ts exposing its own persistence is rejected", () => {
	const { rules } = cruiseFixture({
		...intentionRepository,
		"intentions/index.ts":
			'export { intentionRepository } from "./adapters/persistence/intention-repository";',
		"intercession/application/leak.ts":
			'import { intentionRepository } from "../../intentions";\nexport const leak = intentionRepository;',
	});

	expect(rules).toEqual(["index-not-persistence"]);
});

test("importing a type from a context whose use case touches its own persistence is allowed", () => {
	const { rules } = cruiseFixture({
		...intentionRepository,
		"intentions/application/submit-intention.ts":
			'import { intentionRepository } from "../adapters/persistence/intention-repository";\nexport type SubmittedIntention = { id: string };\nexport const submitIntention = () => intentionRepository;',
		"intentions/index.ts":
			'export { type SubmittedIntention, submitIntention } from "./application/submit-intention";',
		"intercession/application/seen.ts":
			'import type { SubmittedIntention } from "../../intentions";\nexport type Seen = SubmittedIntention;',
	});

	expect(rules).toEqual([]);
});
