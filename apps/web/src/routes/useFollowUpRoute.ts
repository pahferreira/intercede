import { useQuery } from "@tanstack/react-query";
import { useParams, useRouteContext } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { track } from "../analytics";

export function useFollowUpRoute() {
	const { code } = useParams({ from: "/intention/$code" });
	const { client } = useRouteContext({ from: "__root__" });
	const viewed = useRef(false);

	const query = useQuery({
		queryKey: ["follow-up", code],
		queryFn: async () => {
			const response = await client.api.intentions[":code"].$get({
				param: { code },
			});
			const { status } = response;
			if (response.status === 200 || response.status === 404) {
				return response.json();
			}
			throw new Error(`unexpected status ${status}`);
		},
		retry: false,
	});

	const intention =
		query.data && query.data.status !== "not_found" ? query.data : undefined;

	useEffect(() => {
		if (!intention || viewed.current) return;
		viewed.current = true;
		track("followup_viewed", {});
	}, [intention]);

	return {
		intention,
		notFound: query.data?.status === "not_found",
		failed: query.isError,
		retry: () => query.refetch(),
	};
}
