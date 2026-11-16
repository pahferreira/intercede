import posthog from "posthog-js";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initAnalytics } from "./analytics";
import { createApiClient } from "./api";
import { App } from "./app";
import { activateInitialLocale } from "./i18n";
import "./index.css";

const root = document.getElementById("root");

if (root) {
	initAnalytics(import.meta.env.POSTHOG_KEY, posthog);
	await activateInitialLocale();
	createRoot(root).render(
		<StrictMode>
			<App client={createApiClient()} />
		</StrictMode>,
	);
}
