import {
	createRootRouteWithContext,
	createRoute,
	createRouter,
	lazyRouteComponent,
	type RouterHistory,
	redirect,
} from "@tanstack/react-router";
import type { ApiClient } from "./api";
import { Layout } from "./layout";
import { Committed } from "./routes/committed";
import { FollowUp } from "./routes/follow-up";
import { Pray } from "./routes/pray";
import { Submit } from "./routes/submit";
import { submittedOrSkippedRecently } from "./submit-gate";

export type RouterContext = {
	client: ApiClient;
};

const rootRoute = createRootRouteWithContext<RouterContext>()({
	component: Layout,
});

const submitRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	validateSearch: (search): { ask?: true } =>
		search.ask === true || search.ask === "true" ? { ask: true } : {},
	beforeLoad: ({ search }) => {
		if (!search.ask && submittedOrSkippedRecently()) {
			throw redirect({ to: "/pray" });
		}
	},
	component: Submit,
});

const prayRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/pray",
	component: Pray,
});

const committedRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/pray/committed",
	component: Committed,
});

const followUpRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/intention/$code",
	component: FollowUp,
});

const devRoutes = import.meta.env.DEV
	? [
			createRoute({
				getParentRoute: () => rootRoute,
				path: "/design-system",
				component: lazyRouteComponent(
					() => import("./routes/design-system"),
					"DesignSystem",
				),
			}),
		]
	: [];

const routeTree = rootRoute.addChildren([
	submitRoute,
	prayRoute,
	committedRoute,
	followUpRoute,
	...devRoutes,
]);

export function createAppRouter(
	context: RouterContext,
	history?: RouterHistory,
) {
	return createRouter({ routeTree, context, history });
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof createAppRouter>;
	}
}
