import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createApiClient } from "./api";
import { App } from "./app";
import { activateInitialLocale } from "./i18n";
import "./index.css";

const root = document.getElementById("root");

if (root) {
	await activateInitialLocale();
	createRoot(root).render(
		<StrictMode>
			<App client={createApiClient()} />
		</StrictMode>,
	);
}
