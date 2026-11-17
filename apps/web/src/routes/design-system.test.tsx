import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { DesignSystem } from "./design-system";

test.each([
	"violet",
	"violet-raised",
	"violet-sunken",
	"line",
	"line-strong",
	"ivory",
	"ivory-muted",
	"ivory-subtle",
	"ivory-tint",
	"ivory-tint-strong",
	"flame",
	"flame-hover",
	"flame-pressed",
	"flame-tint",
	"on-flame",
	"on-ivory",
	"success",
	"notice",
	"danger",
	"focus-ring",
	"display-xl",
	"display",
	"eyebrow",
	"title",
	"heading",
	"body-lg",
	"body",
	"label",
	"small",
	"caption",
	"shadow-sm",
	"shadow-md",
	"shadow-lg",
	"shadow-flame",
	"radius-sm",
	"radius-md",
	"radius-lg",
	"duration-fast",
	"duration-base",
	"duration-slow",
	"ease-out",
	"ease-in-out",
])("shows the %s token", (name) => {
	render(<DesignSystem />);

	expect(screen.getByRole("figure", { name })).toBeDefined();
});
