import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Textarea } from "./Textarea";

test("shows the current length against the max", () => {
	render(
		<Textarea
			label="Submit your prayer intention"
			value="Pray for my family"
			onChange={() => {}}
			minLength={10}
			maxLength={1000}
		/>,
	);

	expect(screen.getByText("18 / 1000")).toBeDefined();
});

test("a rejected field is invalid and described by its hints", () => {
	render(
		<Textarea
			label="Submit your prayer intention"
			value="Please pray for João Carlos Silva at Rua das Flores 120"
			onChange={() => {}}
			minLength={10}
			maxLength={1000}
			moderationHints={[
				"Use initials instead of full names.",
				"Leave out addresses and contact details.",
			]}
		/>,
	);

	const field = screen.getByRole("textbox", {
		name: "Submit your prayer intention",
	});
	const description = (field.getAttribute("aria-describedby") ?? "")
		.split(" ")
		.map((id) => document.getElementById(id)?.textContent)
		.join(" ");

	expect(field.getAttribute("aria-invalid")).toBe("true");
	expect(description).toContain("Use initials instead of full names.");
	expect(description).toContain("Leave out addresses and contact details.");
});

test("submitting keeps the text and makes the field read-only", () => {
	render(
		<Textarea
			label="Submit your prayer intention"
			value="Pray for my family"
			onChange={() => {}}
			minLength={10}
			maxLength={1000}
			submitting
		/>,
	);

	const field = screen.getByRole<HTMLTextAreaElement>("textbox");
	expect(field.readOnly).toBe(true);
	expect(field.value).toBe("Pray for my family");
});

test("a field without hints is not invalid", () => {
	render(
		<Textarea
			label="Submit your prayer intention"
			value="Pray for my family"
			onChange={() => {}}
			minLength={10}
			maxLength={1000}
		/>,
	);

	expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBeNull();
});
