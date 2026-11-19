import { Trans } from "@lingui/react/macro";

export function Hero() {
	return (
		<section className="flex flex-col gap-space-1">
			<p className="text-eyebrow text-ivory-muted">
				<Trans>Welcome to</Trans>
			</p>
			<p className="font-display text-display md:text-display-xl">Intercede</p>
			<p className="text-body text-ivory-muted">
				<Trans>A place where you can share your faith around the world</Trans>
			</p>
		</section>
	);
}
