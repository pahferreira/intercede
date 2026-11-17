import { expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "./Button";

test("a loading button is busy and named by its loading label", () => {
	render(
		<Button variant="primary" loading loadingLabel="Submitting">
			Submit
		</Button>,
	);

	const button = screen.getByRole("button", { name: "Submitting" });
	expect(button.getAttribute("aria-busy")).toBe("true");
});

test.each([
	{ state: "disabled", props: { disabled: true } },
	{ state: "loading", props: { loading: true, loadingLabel: "Submitting" } },
])("a $state button does not call onClick", ({ props }) => {
	const onClick = mock();
	render(
		<Button variant="primary" onClick={onClick} {...props}>
			Submit
		</Button>,
	);

	fireEvent.click(screen.getByRole("button"));

	expect(onClick).not.toHaveBeenCalled();
});

test("an idle button that can load is named by its label", () => {
	render(
		<Button variant="primary" loading={false} loadingLabel="Submitting">
			Submit
		</Button>,
	);

	expect(screen.getByRole("button", { name: "Submit" })).toBeDefined();
});
