import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

export function Home() {
	const { api } = useRouteContext({ from: "__root__" });
	const health = useQuery({
		queryKey: ["health"],
		queryFn: async () => {
			const response = await api.api.health.$get();
			return response.json();
		},
	});

	if (health.isPending) {
		return <Trans>Checking the API…</Trans>;
	}

	if (health.isError) {
		return <Trans>API unreachable</Trans>;
	}

	const status = health.data.status;
	return <Trans>API status: {status}</Trans>;
}
