import { afterEach, expect, test } from "bun:test";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "../../..");
const biome = join(repoRoot, "node_modules/.bin/biome");

type LintOutput = {
	diagnostics: {
		category: string;
		message: string;
		location: { path: string; start: { line: number } };
	}[];
};

const fixtures: string[] = [];

afterEach(() => {
	for (const fixture of fixtures.splice(0)) {
		rmSync(fixture, { recursive: true, force: true });
	}
});

const lintFixture = (files: Record<string, string>) => {
	const root = mkdtempSync(join(tmpdir(), "biome-plugins-"));
	fixtures.push(root);
	copyFileSync(join(repoRoot, "biome.json"), join(root, "biome.json"));
	symlinkSync(join(repoRoot, "biome-plugins"), join(root, "biome-plugins"));
	for (const [path, source] of Object.entries(files)) {
		const file = join(root, "apps/web/src", path);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, source);
	}
	const { stdout } = Bun.spawnSync(
		[biome, "lint", "--vcs-enabled=false", "--reporter=json", "."],
		{ cwd: root },
	);
	const { diagnostics } = JSON.parse(stdout.toString()) as LintOutput;
	return diagnostics
		.filter((diagnostic) => diagnostic.category === "plugin")
		.map(
			({ location, message }) =>
				`${location.path.replace("apps/web/src/", "")}:${location.start.line} ${message}`,
		)
		.sort();
};

test("ui components compose classes with clsx, not template literals or join", () => {
	expect(
		lintFixture({
			"ui/Template.tsx": `export function Template(props: { wide: boolean }) {
	return <div className={\`p-space-4 \${props.wide ? "w-full" : ""}\`} />;
}
`,
			"ui/Joined.tsx": `export function Joined(props: { wide: boolean }) {
	return <div className={["p-space-4", props.wide && "w-full"].join(" ")} />;
}
`,
		}),
	).toEqual([
		"ui/Joined.tsx:2 Compose UI component classes with clsx.",
		"ui/Template.tsx:2 Compose UI component classes with clsx.",
	]);
});

test("clsx and plain strings in ui, and template literals outside ui, pass", () => {
	expect(
		lintFixture({
			"ui/Composed.tsx": `import { clsx } from "clsx";

export function Composed(props: { wide: boolean }) {
	return (
		<div className={clsx("p-space-4", props.wide && "w-full")}>
			<span className="text-label" />
		</div>
	);
}
`,
			"routes/page.tsx": `export function Page(props: { wide: boolean }) {
	return <div className={\`p-space-4 \${props.wide ? "w-full" : ""}\`} />;
}
`,
		}),
	).toEqual([]);
});
