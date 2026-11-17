import { expect, mock, test } from "bun:test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { type Locale, switchLocale } from "../i18n";
import { MessageBox } from "./message-box";

function Composer({
	onSubmit,
	disabledReason,
}: {
	onSubmit: (text: string) => void;
	disabledReason?: string;
}) {
	const [value, setValue] = useState("");
	return (
		<MessageBox
			value={value}
			onChange={setValue}
			onSubmit={onSubmit}
			placeholder="Tell me more"
			disabledReason={disabledReason}
		/>
	);
}

async function renderComposer(
	props: Parameters<typeof Composer>[0],
	locale: Locale = "en",
) {
	await switchLocale(locale);
	render(
		<I18nProvider i18n={i18n}>
			<Composer {...props} />
		</I18nProvider>,
	);
	return {
		input: screen.getByRole("textbox"),
		send: screen.getByRole("button"),
	};
}

test("Enter submits the text", async () => {
	const onSubmit = mock();
	const { input } = await renderComposer({ onSubmit });

	fireEvent.change(input, { target: { value: "Pray for my mother" } });
	fireEvent.keyDown(input, { key: "Enter" });

	expect(onSubmit).toHaveBeenCalledWith("Pray for my mother");
});

test("Shift+Enter doesn't submit", async () => {
	const onSubmit = mock();
	const { input } = await renderComposer({ onSubmit });

	fireEvent.change(input, { target: { value: "Pray for my mother" } });
	fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

	expect(onSubmit).not.toHaveBeenCalled();
});

test("whitespace-only text keeps Send disabled", async () => {
	const onSubmit = mock();
	const { input, send } = await renderComposer({ onSubmit });

	fireEvent.change(input, { target: { value: "  \n " } });
	fireEvent.keyDown(input, { key: "Enter" });

	expect(send).toHaveProperty("disabled", true);
	expect(onSubmit).not.toHaveBeenCalled();

	fireEvent.change(input, { target: { value: "Pray" } });

	expect(send).toHaveProperty("disabled", false);
});

test("a disabled composer disables both controls and shows its reason", async () => {
	const { input, send } = await renderComposer({
		onSubmit: mock(),
		disabledReason: "You're offline.",
	});

	fireEvent.change(input, { target: { value: "Pray" } });

	expect(input).toHaveProperty("disabled", true);
	expect(send).toHaveProperty("disabled", true);
	expect(screen.getByText("You're offline.")).toBeDefined();
});

test.each([
	["en", "Message", "Send"],
	["pt-BR", "Mensagem", "Enviar"],
] as const)("names its controls in %s", async (locale, input, send) => {
	await renderComposer({ onSubmit: mock() }, locale);

	expect(screen.getByRole("textbox", { name: input })).toBeDefined();
	expect(screen.getByRole("button", { name: send })).toBeDefined();
});
