import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RouterHistory, RouterProvider } from "@tanstack/react-router";
import { useState } from "react";
import type { ApiClient } from "./api";
import { createAppRouter } from "./router";

type AppProps = {
	client: ApiClient;
	history?: RouterHistory;
};

export function App(props: AppProps) {
	const [queryClient] = useState(() => new QueryClient());
	const [router] = useState(() =>
		createAppRouter({ client: props.client }, props.history),
	);

	return (
		<I18nProvider i18n={i18n}>
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>
		</I18nProvider>
	);
}
