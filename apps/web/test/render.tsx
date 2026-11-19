import type { SearchEvent } from "@intercede/api";
import { type AppDependencies, createApp } from "@intercede/api/testing";
import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { createApiClient } from "../src/api";
import { App } from "../src/app";
import { type Locale, switchLocale } from "../src/i18n";

export type SubmitIntention = AppDependencies["submitIntention"];

export type Search = AppDependencies["search"];

const submissionNotExpected: SubmitIntention = async () => {
	throw new Error("this test does not expect a submission");
};

const searchNotExpected: Search = () => {
	throw new Error("this test does not expect a search");
};

export function searchOf(events: SearchEvent[]): Search {
	return async function* () {
		yield* events;
	};
}

export function controlledSearch() {
	const entries: string[] = [];
	const pending: SearchEvent[] = [];
	let ended = false;
	let wake: (() => void) | undefined;
	const notify = () => {
		wake?.();
		wake = undefined;
	};
	const search: Search = async function* ({ entry }) {
		entries.push(entry);
		while (true) {
			const event = pending.shift();
			if (event) {
				yield event;
			} else if (ended) {
				return;
			} else {
				await new Promise<void>((resolve) => {
					wake = resolve;
				});
			}
		}
	};
	const send = (...events: SearchEvent[]) => {
		pending.push(...events);
		notify();
	};
	const end = () => {
		ended = true;
		notify();
	};
	return { search, send, end, entries };
}

export async function renderAt(
	path: string,
	locale: Locale,
	submitIntention = submissionNotExpected,
	search = searchNotExpected,
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
		search,
	});
	const client = createApiClient(app.request);
	const history = createMemoryHistory({ initialEntries: [path] });
	return {
		...render(
			<StrictMode>
				<App client={client} history={history} />
			</StrictMode>,
		),
		history,
	};
}
