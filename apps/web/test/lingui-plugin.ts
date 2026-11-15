import { relative } from "node:path";
import {
	createCompiledCatalog,
	getCatalogForFile,
	getCatalogs,
} from "@lingui/cli/api";
import { getConfig } from "@lingui/conf";
import { mapMacroOptions, transform } from "@lingui/native-tools";
import type { BunPlugin } from "bun";

export async function linguiPlugin(): Promise<BunPlugin> {
	const config = getConfig({ cwd: `${import.meta.dir}/..` });
	const catalogs = await getCatalogs(config);

	return {
		name: "lingui",
		setup(build) {
			build.onLoad({ filter: /\/src\/.*\.tsx?$/ }, async ({ path }) => {
				const source = await Bun.file(path).text();
				if (!source.includes("@lingui/react/macro")) {
					return { contents: source, loader: "tsx" };
				}
				const { code } = await transform(source, path, {
					macro: mapMacroOptions(config),
					sourceMaps: "inline",
				});
				return { contents: code, loader: "jsx" };
			});

			build.onLoad({ filter: /\.po$/ }, async ({ path }) => {
				const fileCatalog = getCatalogForFile(
					relative(config.rootDir, path),
					catalogs,
				);
				if (!fileCatalog) {
					throw new Error(`No Lingui catalog matches ${path}`);
				}
				const { locale, catalog } = fileCatalog;
				const { messages } = await catalog.getTranslations(locale, {
					fallbackLocales: config.fallbackLocales,
					sourceLocale: config.sourceLocale,
				});
				const { source } = createCompiledCatalog(locale, messages, {
					namespace: "es",
				});
				return { contents: source, loader: "js" };
			});
		},
	};
}
