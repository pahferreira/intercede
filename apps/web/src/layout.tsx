import { Trans } from "@lingui/react/macro";
import { Outlet, useSearch } from "@tanstack/react-router";
import markOnDark from "./assets/logos/intercede-mark-on-dark.svg";
import { LanguageToggle } from "./language-toggle";
import { Link } from "./ui/Link";

export function Layout() {
	const chatOpen = useSearch({
		strict: false,
		select: (search) => "chat" in search && search.chat === true,
	});

	return (
		<div className="flex min-h-dvh flex-col px-space-4 pt-space-3 pb-space-5 md:px-space-5">
			<header className="flex items-center justify-between gap-space-3">
				<img src={markOnDark} alt="Intercede" className="h-control-md" />
				<div className="flex items-center gap-space-4">
					{chatOpen && (
						<Link to="/pray">
							<Trans>New search</Trans>
						</Link>
					)}
					<LanguageToggle />
				</div>
			</header>
			<main className="pt-space-5">
				<Outlet />
			</main>
		</div>
	);
}
