import { Outlet } from "@tanstack/react-router";
import { LanguageToggle } from "./language-toggle";

export function Layout() {
	return (
		<div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 p-4">
			<header className="flex items-center justify-between">
				<span className="font-semibold">Intercede</span>
				<LanguageToggle />
			</header>
			<main>
				<Outlet />
			</main>
		</div>
	);
}
