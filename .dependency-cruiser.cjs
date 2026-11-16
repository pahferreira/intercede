module.exports = {
	forbidden: [
		{
			name: "context-via-index",
			severity: "error",
			from: { path: "^apps/api/src/([^/]+)" },
			to: {
				path: "^apps/api/src/(?!platform/|handlers/)[^/]+/",
				pathNot: ["^apps/api/src/$1/", "^apps/api/src/[^/]+/index\\.ts$"],
			},
		},
		{
			name: "domain-not-adapters",
			severity: "error",
			from: { path: "^apps/api/src/[^/]+/domain/" },
			to: { path: "^apps/api/src/[^/]+/adapters/" },
		},
		{
			name: "domain-no-framework",
			severity: "error",
			from: { path: "^apps/api/src/[^/]+/domain/" },
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
			name: "no-foreign-persistence",
			severity: "error",
			from: { path: "^apps/api/src/(?!platform/|handlers/)([^/]+)/" },
			to: {
				path: "^apps/api/src/[^/]+/adapters/persistence/",
				pathNot: "^apps/api/src/$1/",
				reachable: true,
			},
		},
	],
	options: {
		parser: "swc",
		tsConfig: { fileName: "apps/api/tsconfig.json" },
		doNotFollow: { path: "node_modules" },
	},
};
