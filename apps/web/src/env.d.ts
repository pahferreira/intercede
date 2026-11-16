/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly POSTHOG_KEY?: string;
}

declare module "*.po" {
	import type { Messages } from "@lingui/core";
	export const messages: Messages;
}
