import { afterEach, expect, mock, test } from "bun:test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { type Locale, switchLocale } from "../i18n";
import { SuggestionCard } from "./SuggestionCard";

const lineHeight = 28;

function layOutTextOfLines(lines: number) {
	const style = document.createElement("style");
	style.textContent = `p { line-height: ${lineHeight}px; }`;
	document.head.append(style);
	Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
		configurable: true,
		get: () => lines * lineHeight,
	});
}

afterEach(() => {
	for (const style of document.head.querySelectorAll("style")) {
		style.remove();
	}
	Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
});

async function renderCard(
	locale: Locale,
	props: {
		checked?: boolean;
		onCheckedChange?: (checked: boolean) => void;
	} = {},
) {
	await switchLocale(locale);
	return render(
		<I18nProvider i18n={i18n}>
			<SuggestionCard
				text="I lost my job last month and I have two kids."
				whyNote="Fits because you asked to pray for people going through hard times."
				checked={props.checked ?? false}
				onCheckedChange={props.onCheckedChange ?? (() => {})}
			/>
		</I18nProvider>,
	);
}

test("ticking the checkbox commits", async () => {
	const onCheckedChange = mock();
	await renderCard("en", { onCheckedChange });

	fireEvent.click(
		screen.getByRole("checkbox", { name: "Commit to pray for this intention" }),
	);

	expect(onCheckedChange).toHaveBeenCalledWith(true);
});

test("tapping the text or the why-note never commits", async () => {
	const onCheckedChange = mock();
	await renderCard("en", { onCheckedChange });

	fireEvent.click(
		screen.getByText("I lost my job last month and I have two kids."),
	);
	fireEvent.click(
		screen.getByText(
			"Fits because you asked to pray for people going through hard times.",
		),
	);

	expect(onCheckedChange).not.toHaveBeenCalled();
});

test("text that fits in three lines has no Show more", async () => {
	layOutTextOfLines(3);
	await renderCard("en");

	expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
});

test("Show more expands longer text and Show less collapses it, without committing", async () => {
	layOutTextOfLines(4);
	const onCheckedChange = mock();
	await renderCard("en", { onCheckedChange });

	fireEvent.click(
		screen.getByRole("button", { name: "Show more", expanded: false }),
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Show less", expanded: true }),
	);

	expect(
		screen.getByRole("button", { name: "Show more", expanded: false }),
	).toBeDefined();
	expect(onCheckedChange).not.toHaveBeenCalled();
});

test("the card speaks Portuguese", async () => {
	layOutTextOfLines(4);
	await renderCard("pt-BR");

	expect(
		screen.getByRole("checkbox", {
			name: "Comprometer-me a orar por esta intenção",
		}),
	).toBeDefined();
	fireEvent.click(screen.getByRole("button", { name: "Mostrar mais" }));
	expect(screen.getByRole("button", { name: "Mostrar menos" })).toBeDefined();
});
