import { Trans } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";

export function Pray() {
	return (
		<>
			<h1>
				<Trans>Pray</Trans>
			</h1>
			<Link to="/" search={{ ask: true }}>
				<Trans>Ask for prayer</Trans>
			</Link>
		</>
	);
}
