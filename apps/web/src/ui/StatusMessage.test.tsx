import { expect, mock, test } from "bun:test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { switchLocale } from "../i18n";
import { StatusMessage } from "./StatusMessage";

test("Retry calls its handler", async () => {
	const onRetry = mock();
	await switchLocale("en");
	render(
		<I18nProvider i18n={i18n}>
			<StatusMessage tone="danger" onRetry={onRetry}>
				Couldn't load intentions.
			</StatusMessage>
		</I18nProvider>,
	);

	fireEvent.click(screen.getByRole("button", { name: "Retry" }));

	expect(onRetry).toHaveBeenCalledTimes(1);
});

test("without a handler it shows only its words", async () => {
	await switchLocale("en");
	render(
		<I18nProvider i18n={i18n}>
			<StatusMessage tone="success">Copied ✓</StatusMessage>
		</I18nProvider>,
	);

	expect(screen.getByText("Copied ✓")).toBeDefined();
	expect(screen.queryByRole("button")).toBeNull();
});
