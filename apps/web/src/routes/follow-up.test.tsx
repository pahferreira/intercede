import { afterEach, beforeEach, expect, test } from "bun:test";
import { fireEvent, screen } from "@testing-library/react";
import { type FindFollowUp, renderAt } from "../../test/render";
import { initAnalytics } from "../analytics";

let events: { event: string; properties: unknown }[] = [];
const posthog = {
	init: () => {},
	capture: (event: string, properties: unknown) => {
		events.push({ event, properties });
	},
};

beforeEach(() => {
	events = [];
	initAnalytics("phc_test", posthog);
});

afterEach(() => {
	initAnalytics(undefined, posthog);
});

const text = "For my brother's new job";

const labels = {
	en: {
		heading: "Your prayer request",
		published: "Published Nov 12, 2026",
		count: "3 people committed to pray for this",
		archived: "This prayer request is no longer being suggested",
		notFound: "Link not found",
		failed: "Couldn't load this prayer request.",
		retry: "Retry",
		prayToo: "Pray for someone too",
		entry: "What would you like to pray for today?",
	},
	"pt-BR": {
		heading: "Seu pedido de oração",
		published: "Publicado em 12 de nov. de 2026",
		count: "3 pessoas se comprometeram a rezar por este pedido",
		archived: "Este pedido não está mais sendo sugerido",
		notFound: "Link não encontrado",
		failed: "Não foi possível carregar este pedido de oração.",
		retry: "Tentar de novo",
		prayToo: "Reze por alguém também",
		entry: "Pelo que você quer interceder hoje?",
	},
} as const;

const followUpOf = (
	status: "published" | "archived",
	codes: string[] = [],
): FindFollowUp => {
	return async (code) => {
		codes.push(code);
		return {
			ok: true,
			value: {
				status,
				text,
				publishedAt: new Date(2026, 10, 12, 14, 30),
				commitments: 3,
			},
		};
	};
};

const notFound: FindFollowUp = async () => {
	return { ok: false, error: { kind: "not_found" } };
};

const openFollowUp = (
	locale: keyof typeof labels,
	findFollowUp: FindFollowUp,
) => {
	return renderAt(
		"/intention/INT-7K3QD",
		locale,
		undefined,
		undefined,
		undefined,
		findFollowUp,
	);
};

const byTextContent = (content: string) => {
	return (_: string, element: Element | null) => {
		return (
			element?.textContent === content &&
			[...element.children].every((child) => child.textContent !== content)
		);
	};
};

test.each(["en", "pt-BR"] as const)(
	"in %s, the follow-up shows the Intention, when it was published and how many committed",
	async (locale) => {
		const codes: string[] = [];
		await openFollowUp(locale, followUpOf("published", codes));

		expect(
			await screen.findByRole("heading", { name: labels[locale].heading }),
		).toBeDefined();
		expect(screen.getByText(text)).toBeDefined();
		expect(screen.getByText(labels[locale].published)).toBeDefined();
		expect(screen.getByText(byTextContent(labels[locale].count))).toBeDefined();
		expect(screen.queryByText(labels[locale].archived)).toBeNull();
		expect(codes).toEqual(["INT-7K3QD"]);
	},
);

test.each(["en", "pt-BR"] as const)(
	"in %s, an Archived Intention is no longer suggested and still shows its count",
	async (locale) => {
		await openFollowUp(locale, followUpOf("archived"));

		expect(await screen.findByText(labels[locale].archived)).toBeDefined();
		expect(screen.getByText(byTextContent(labels[locale].count))).toBeDefined();
	},
);

test.each(["en", "pt-BR"] as const)(
	"in %s, an unknown Intention Code shows Link not found",
	async (locale) => {
		await openFollowUp(locale, notFound);

		expect(
			await screen.findByRole("heading", { name: labels[locale].notFound }),
		).toBeDefined();
		expect(screen.queryByText(text)).toBeNull();
	},
);

test.each(["en", "pt-BR"] as const)(
	"in %s, a follow-up that fails to load can be retried",
	async (locale) => {
		let fails = true;
		const failsOnce: FindFollowUp = async (code) => {
			if (fails) {
				fails = false;
				throw new Error("database unreachable");
			}
			return followUpOf("published")(code);
		};
		await openFollowUp(locale, failsOnce);

		expect(await screen.findByText(labels[locale].failed)).toBeDefined();

		fireEvent.click(screen.getByRole("button", { name: labels[locale].retry }));

		expect(await screen.findByText(text)).toBeDefined();
	},
);

test.each([
	["found", followUpOf("published")],
	["not found", notFound],
] as const)(
	"Pray for someone too opens the Entry screen when the Intention is %s",
	async (_, findFollowUp) => {
		await openFollowUp("en", findFollowUp);

		fireEvent.click(
			await screen.findByRole("link", { name: labels.en.prayToo }),
		);

		expect(
			await screen.findByRole("textbox", { name: labels.en.entry }),
		).toBeDefined();
	},
);

test("viewing a follow-up is counted once, with no properties", async () => {
	await openFollowUp("en", followUpOf("published"));
	await screen.findByText(text);

	expect(events.filter((event) => event.event === "followup_viewed")).toEqual([
		{ event: "followup_viewed", properties: {} },
	]);
});

test("an unknown Intention Code is not counted as a follow-up view", async () => {
	await openFollowUp("en", notFound);
	await screen.findByRole("heading", { name: labels.en.notFound });

	expect(events.filter((event) => event.event === "followup_viewed")).toEqual(
		[],
	);
});
