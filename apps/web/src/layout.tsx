import { Outlet } from "@tanstack/react-router";
import markOnDark from "./assets/logos/intercede-mark-on-dark.svg";
import { LanguageToggle } from "./language-toggle";

export function Layout() {
	return (
		<div className="flex min-h-dvh flex-col px-space-4 pt-space-3 pb-space-5 md:px-space-5">
			<header className="flex items-center justify-between">
				<img src={markOnDark} alt="Intercede" className="h-control-md" />
				<LanguageToggle />
			</header>
			<main className="pt-space-5">
				<Outlet />
			</main>
		</div>
	);
}
