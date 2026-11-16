const sourceRoot = "^apps/api/src/";
const nonContextFolders = ["platform", "handlers"];

const notNonContext = `(?!${nonContextFolders.map((folder) => `${folder}/`).join("|")})`;
const context = `${sourceRoot}${notNonContext}([^/]+)/`;
const anyContext = `${sourceRoot}[^/]+/`;

module.exports = {
	forbidden: [
		{
			name: "context-via-index",
			severity: "error",
			from: { path: `${sourceRoot}([^/]+)` },
			to: {
				path: context,
				pathNot: [`${sourceRoot}$1/`, `${anyContext}index\\.ts$`],
			},
		},
		{
			name: "domain-not-adapters",
			severity: "error",
			from: { path: `${anyContext}domain/` },
			to: { path: `${anyContext}adapters/` },
		},
		{
			name: "domain-no-framework",
			severity: "error",
			from: { path: `${anyContext}domain/` },
			to: {
				dependencyTypes: [
					"core",
					"npm",
					"npm-dev",
					"npm-optional",
					"npm-peer",
					"npm-no-pkg",
					"npm-unknown",
				],
			},
		},
		{
			name: "domain-platform-result-only",
			severity: "error",
			from: { path: `${anyContext}domain/` },
			to: {
				path: `${sourceRoot}platform/`,
				pathNot: `${sourceRoot}platform/result\\.ts$`,
			},
		},
		{
			name: "no-foreign-persistence",
			severity: "error",
			from: { path: context },
			to: {
				path: `${anyContext}adapters/persistence/`,
				pathNot: `${sourceRoot}$1/`,
			},
		},
		{
			name: "index-not-persistence",
			severity: "error",
			from: { path: `${context}index\\.ts$` },
			to: { path: `${sourceRoot}$1/adapters/persistence/` },
		},
	],
	options: {
		parser: "swc",
		tsConfig: { fileName: "apps/api/tsconfig.json" },
		doNotFollow: { path: "node_modules" },
	},
};
