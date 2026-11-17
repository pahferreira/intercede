import { Outlet } from "@tanstack/react-router";
import { LanguageToggle } from "./language-toggle";

export function Layout() {
	return (
		<div className="flex min-h-dvh flex-col px-space-4 pt-space-3 pb-space-5 md:px-space-5">
			<header className="flex justify-end">
				<LanguageToggle />
			</header>
			<main>
				<Outlet />
			</main>
		</div>
	);
}
