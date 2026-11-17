import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { __unstable__loadDesignSystem } from "tailwindcss";
import { locales } from "./i18n";

const designSystem = await __unstable__loadDesignSystem(
	await readFile(join(import.meta.dir, "index.css"), "utf8"),
	{
		base: import.meta.dir,
		async loadStylesheet(id: string, base: string) {
			const path =
				id === "tailwindcss"
					? Bun.resolveSync("tailwindcss/index.css", import.meta.dir)
					: join(base, id);
			return {
				path,
				base: dirname(path),
				content: await readFile(path, "utf8"),
			};
		},
	},
);

const quoted = /"([^"\n]*)"|'([^'\n]*)'/g;
const templated = /`([^`]*)`/g;
const interpolation = /\$\{[^}]*\}/g;

const unknownClasses = (source: string) => {
	const strings = [
		...[...source.matchAll(quoted)].map((match) => match[1] ?? match[2] ?? ""),
		...[...source.matchAll(templated)].map((match) =>
			(match[1] ?? "").replace(interpolation, " "),
		),
	];
	const tokens = new Set(strings.flatMap((string) => string.split(/\s+/)));
	return [...tokens]
		.filter(
			(token) =>
				/[-:]/.test(token) &&
				!locales.some((locale) => locale === token) &&
				designSystem.parseCandidate(token).length > 0 &&
				designSystem.candidatesToCss([token])[0] === null,
		)
		.sort();
};

test("flags a class the theme does not define", () => {
	expect(
		unknownClasses(`<div className="bg-violet-rasied p-space-4" />`),
	).toEqual(["bg-violet-rasied"]);
});

test("flags the default spacing scale", () => {
	expect(
		unknownClasses(
			`<div className={clsx(\`min-h-42 \${open && 'size-5'}\`, 'gap-space-2')} />`,
		),
	).toEqual(["min-h-42", "size-5"]);
});

test("passes theme classes, variants, keywords, copy and locales", () => {
	expect(
		unknownClasses(
			`<p lang="pt-BR" className={clsx("hover:not-read-only:bg-ivory-tint -translate-y-px", ok && "text-label border-r-transparent")}>What's a follow-up?</p>`,
		),
	).toEqual([]);
});

const sources = [
	...new Bun.Glob("**/*.{ts,tsx}").scanSync({ cwd: import.meta.dir }),
].filter((path) => !/\.test\.tsx?$/.test(path));

test.each(sources)(
	"every class in %s comes from the design system",
	async (path) => {
		const source = await readFile(join(import.meta.dir, path), "utf8");

		expect(unknownClasses(source)).toEqual([]);
	},
);
