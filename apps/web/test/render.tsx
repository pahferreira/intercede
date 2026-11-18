import { type AppDependencies, createApp } from "@intercede/api/testing";
import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { createApiClient } from "../src/api";
import { App } from "../src/app";
import { type Locale, switchLocale } from "../src/i18n";

export type SubmitIntention = AppDependencies["submitIntention"];

const submissionNotExpected: SubmitIntention = async () => {
	throw new Error("this test does not expect a submission");
};

export async function renderAt(
	path: string,
	locale: Locale,
	submitIntention = submissionNotExpected,
) {
	await switchLocale(locale);
	const app = createApp({
		isDatabaseReachable: async () => true,
		openAnalytics: () => ({
			captureException: () => {},
			captureLlmGeneration: () => {},
			shutdown: async () => {},
		}),
		submitIntention,
		search: () => {
			throw new Error("this test does not expect a search");
		},
	});
	const client = createApiClient(app.request);
	const history = createMemoryHistory({ initialEntries: [path] });
	return render(
		<StrictMode>
			<App client={client} history={history} />
		</StrictMode>,
	);
}
