import { useMutation } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { track } from "../analytics";
import { rememberCommitments } from "../commitments";

type UseCommitOptions = {
	selected: ReadonlySet<string>;
	onUnavailable: (intentionIds: string[]) => void;
};

export function useCommit(options: UseCommitOptions) {
	const navigate = useNavigate();
	const { client } = useRouteContext({ from: "__root__" });

	const mutation = useMutation({
		mutationFn: async (intentionIds: string[]) => {
			const response = await client.api.commitments.$post({
				json: { intentionIds },
			});
			if (response.status === 201 || response.status === 422) {
				return response.json();
			}
			throw new Error(`unexpected status ${response.status}`);
		},
		onSuccess: (result) => {
			if (result.status === "not_suggested") {
				options.onUnavailable(result.intentionIds);
				return;
			}
			rememberCommitments(result.commitments);
			return navigate({ to: "/pray/committed" });
		},
	});

	const sendSelected = () => {
		return mutation.mutate([...options.selected]);
	};

	return {
		commit: () => {
			track("commit_clicked", { count: options.selected.size });
			sendSelected();
		},
		retry: sendSelected,
		reset: mutation.reset,
		pending: mutation.isPending,
		failed: mutation.isError,
		unavailable: mutation.data?.status === "not_suggested",
	};
}

export type CommitControls = ReturnType<typeof useCommit>;
