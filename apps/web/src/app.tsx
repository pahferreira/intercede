import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RouterHistory, RouterProvider } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ApiClient } from "./api";
import { activateLocale, type Locale } from "./i18n";
import { createAppRouter } from "./router";

type AppProps = {
	api: ApiClient;
	locale: Locale;
	history?: RouterHistory;
};

export function App({ api, locale, history }: AppProps) {
	const [queryClient] = useState(() => new QueryClient());
	const [router] = useState(() =>
		createAppRouter({ api, queryClient }, history),
	);

	useEffect(() => {
		activateLocale(locale);
	}, [locale]);

	return (
		<I18nProvider i18n={i18n}>
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>
		</I18nProvider>
	);
}
