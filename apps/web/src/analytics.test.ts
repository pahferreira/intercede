import { expect, test } from "bun:test";
import type { PostHogConfig } from "posthog-js";
import { initAnalytics, track } from "./analytics";

function fakePostHog() {
	const captured: { event: string; properties: unknown }[] = [];
	const inits: { key: string; config: Partial<PostHogConfig> }[] = [];
	return {
		captured,
		inits,
		client: {
			init: (key: string, config: Partial<PostHogConfig>) => {
				inits.push({ key, config });
			},
			capture: (event: string, properties: unknown) => {
				captured.push({ event, properties });
			},
		},
	};
}

test("without a key PostHog is never initialised and events are dropped", () => {
	const posthog = fakePostHog();

	initAnalytics(undefined, posthog.client);
	track("entry_sent", {});

	expect(posthog.inits).toEqual([]);
	expect(posthog.captured).toEqual([]);
});

test("with a key PostHog sends through /ingest, counts page views and exceptions and never records sessions or page text", () => {
	const posthog = fakePostHog();

	initAnalytics("phc_test", posthog.client);

	expect(posthog.inits).toHaveLength(1);
	expect(posthog.inits[0]).toMatchObject({
		key: "phc_test",
		config: {
			api_host: "/ingest",
			capture_exceptions: true,
			disable_session_recording: true,
			autocapture: false,
			rageclick: false,
			capture_dead_clicks: false,
			capture_heatmaps: false,
			capture_pageview: "history_change",
			capture_pageleave: true,
		},
	});
});

test("a page view of a follow-up page never carries its Intention Code", () => {
	const posthog = fakePostHog();
	initAnalytics("phc_test", posthog.client);
	const beforeSend = posthog.inits[0]?.config.before_send;
	if (typeof beforeSend !== "function") {
		throw new Error("before_send is not configured");
	}

	const sent = beforeSend({
		uuid: "0",
		event: "$pageview",
		properties: {
			$current_url: "https://intercede.pahferreira.dev/intention/INT-7K3QD?x=1",
			$pathname: "/intention/INT-7K3QD",
			$referrer: "https://intercede.pahferreira.dev/intention/INT-7K3QD",
			title: "Intercede",
		},
	});

	expect(sent?.properties).toEqual({
		$current_url: "https://intercede.pahferreira.dev/intention/:code?x=1",
		$pathname: "/intention/:code",
		$referrer: "https://intercede.pahferreira.dev/intention/:code",
		title: "Intercede",
	});
});

test("an exception keeps its type and stack but never its message", () => {
	const posthog = fakePostHog();
	initAnalytics("phc_test", posthog.client);
	const beforeSend = posthog.inits[0]?.config.before_send;
	if (typeof beforeSend !== "function") {
		throw new Error("before_send is not configured");
	}
	const frames = [
		{ platform: "web:javascript", filename: "app.js", lineno: 3, colno: 7 },
	];

	const sent = beforeSend({
		uuid: "0",
		event: "$exception",
		properties: {
			$exception_message: "Cannot parse pray for my sister Maria",
			$exception_list: [
				{
					type: "TypeError",
					value: "Cannot parse pray for my sister Maria",
					mechanism: { handled: false, type: "onerror" },
					stacktrace: { type: "raw", frames },
				},
			],
		},
	});

	expect(JSON.stringify(sent)).not.toContain("Maria");
	expect(sent?.properties.$exception_list).toEqual([
		{
			type: "TypeError",
			value: "[redacted]",
			mechanism: { handled: false, type: "onerror" },
			stacktrace: { type: "raw", frames },
		},
	]);
});

test("events carry only their allowlisted counts and enums", () => {
	const posthog = fakePostHog();
	initAnalytics("phc_test", posthog.client);

	const leaky = {
		count: 3,
		fallback: false,
		entry: "pray for my sister Maria",
	};
	track("suggestions_shown", leaky);
	track("intention_rejected", { reason: "personal_data" });
	track("refinement_sent", { n: 2 });
	track("commit_clicked", { count: 1 });
	track("followup_viewed", {});

	expect(posthog.captured).toEqual([
		{ event: "suggestions_shown", properties: { count: 3, fallback: false } },
		{ event: "intention_rejected", properties: { reason: "personal_data" } },
		{ event: "refinement_sent", properties: { n: 2 } },
		{ event: "commit_clicked", properties: { count: 1 } },
		{ event: "followup_viewed", properties: {} },
	]);
});

test("free text is dropped where a count or an enum is expected", () => {
	const posthog = fakePostHog();
	initAnalytics("phc_test", posthog.client);

	track("intention_rejected", {
		reason: "my neighbour John Smith" as "spam",
	});
	track("commit_clicked", { count: "Maria" as unknown as number });

	expect(posthog.captured).toEqual([
		{ event: "intention_rejected", properties: {} },
		{ event: "commit_clicked", properties: {} },
	]);
});

test("events reach a client whose capture depends on its own instance", () => {
	class StatefulPostHog {
		loaded = false;
		captured: string[] = [];
		init() {
			this.loaded = true;
		}
		capture(event: string) {
			if (!this.loaded) {
				throw new Error("PostHog is not loaded");
			}
			this.captured.push(event);
		}
	}
	const client = new StatefulPostHog();
	initAnalytics("phc_test", client);

	track("entry_sent", {});

	expect(client.captured).toEqual(["entry_sent"]);
});
