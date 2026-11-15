import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createApiClient } from "./api";
import { App } from "./app";
import { initialLocale } from "./i18n";
import "./index.css";

const root = document.getElementById("root");

if (root) {
	createRoot(root).render(
		<StrictMode>
			<App api={createApiClient()} locale={initialLocale()} />
		</StrictMode>,
	);
}
