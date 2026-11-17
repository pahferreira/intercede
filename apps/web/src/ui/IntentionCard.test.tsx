import { expect, test } from "bun:test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { render, screen } from "@testing-library/react";
import { type Locale, switchLocale } from "../i18n";
import { IntentionCard } from "./IntentionCard";

const text =
	"Pray for my brother R., who is far from God and far from home. That he feels loved wherever he is.";

async function renderCard(
	locale: Locale,
	props: { commitments?: number; archived?: boolean } = {},
) {
	await switchLocale(locale);
	return render(
		<I18nProvider i18n={i18n}>
			<IntentionCard
				text={text}
				publishedAt={new Date(2026, 10, 12)}
				commitments={props.commitments ?? 7}
				archived={props.archived ?? false}
			/>
		</I18nProvider>,
	);
}

function textContent(content: string) {
	return (_: string, element: Element | null) =>
		element?.textContent === content &&
		[...element.children].every((child) => child.textContent !== content);
}

test("shows the full text, the publication date and how many committed", async () => {
	await renderCard("en");

	expect(screen.getByText(text)).toBeDefined();
	expect(screen.getByText("Published Nov 12, 2026")).toBeDefined();
	expect(
		screen.getByText(textContent("7 people committed to pray for this")),
	).toBeDefined();
	expect(
		screen.queryByText("This intention is no longer being suggested"),
	).toBeNull();
});

test("one commitment reads in the singular", async () => {
	await renderCard("en", { commitments: 1 });

	expect(
		screen.getByText(textContent("1 person committed to pray for this")),
	).toBeDefined();
});

test("an archived intention says it is no longer suggested", async () => {
	await renderCard("en", { archived: true });

	expect(
		screen.getByText("This intention is no longer being suggested"),
	).toBeDefined();
});

test("the meta line speaks Portuguese", async () => {
	await renderCard("pt-BR", { archived: true });

	expect(screen.getByText("Publicada em 12 de nov. de 2026")).toBeDefined();
	expect(
		screen.getByText(
			textContent("7 pessoas se comprometeram a rezar por esta intenção"),
		),
	).toBeDefined();
	expect(
		screen.getByText("Esta intenção não está mais sendo sugerida"),
	).toBeDefined();
});

test("one commitment reads in the Portuguese singular", async () => {
	await renderCard("pt-BR", { commitments: 1 });

	expect(
		screen.getByText(
			textContent("1 pessoa se comprometeu a rezar por esta intenção"),
		),
	).toBeDefined();
});

test("no commitments read in the Portuguese plural", async () => {
	await renderCard("pt-BR", { commitments: 0 });

	expect(
		screen.getByText(
			textContent("0 pessoas se comprometeram a rezar por esta intenção"),
		),
	).toBeDefined();
});
