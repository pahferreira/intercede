import type { SearchEvent } from "@intercede/api";
import { type AppDependencies, createApp } from "@intercede/api/testing";
import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { createApiClient } from "../src/api";
import { App } from "../src/app";
import { type Locale, switchLocale } from "../src/i18n";

export type SubmitIntention = AppDependencies["submitIntention"];

export type SearchStream = (entry: string) => Response;

type Fetch = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Response | Promise<Response>;

const submissionNotExpected: SubmitIntention = async () => {
	throw new Error("this test does not expect a submission");
};

const searchNotExpected: SearchStream = () => {
	throw new Error("this test does not expect a search");
};

const encoder = new TextEncoder();

function encodeEvent(event: SearchEvent) {
	return encoder.encode(
		`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`,
	);
}

function eventStream(body: ReadableStream<Uint8Array>) {
	return new Response(body, {
		headers: { "content-type": "text/event-stream" },
	});
}

export function searchStreamOf(events: SearchEvent[]): SearchStream {
	return () =>
		eventStream(
			new ReadableStream({
				start: (controller) => {
					for (const event of events) {
						controller.enqueue(encodeEvent(event));
					}
					controller.close();
				},
			}),
		);
}

export function controlledSearch() {
	const entries: string[] = [];
	let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
	const search: SearchStream = (entry) => {
		entries.push(entry);
		return eventStream(
			new ReadableStream({
				start: (started) => {
					controller = started;
				},
			}),
		);
	};
	const send = (...events: SearchEvent[]) => {
		for (const event of events) {
			controller?.enqueue(encodeEvent(event));
		}
	};
	const end = () => controller?.close();
	return { search, send, end, entries };
}

function withSearch(request: Fetch, search: SearchStream): Fetch {
	return (input, init) => {
		const url = new URL(
			input instanceof Request ? input.url : input,
			"http://localhost",
		);
		if (url.pathname === "/api/search" && init?.method === "POST") {
			const body: { entry: string } = JSON.parse(String(init.body));
			return search(body.entry);
		}
		return request(input, init);
	};
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
		search: () => {
			throw new Error("this test does not expect a search");
		},
	});
	const client = createApiClient(withSearch(app.request, search));
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
