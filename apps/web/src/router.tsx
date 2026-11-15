import {
	createRootRouteWithContext,
	createRoute,
	createRouter,
	type RouterHistory,
} from "@tanstack/react-router";
import type { ApiClient } from "./api";
import { Layout } from "./layout";
import { Committed } from "./routes/committed";
import { FollowUp } from "./routes/follow-up";
import { Home } from "./routes/home";
import { Pray } from "./routes/pray";

export type RouterContext = {
	client: ApiClient;
};

const rootRoute = createRootRouteWithContext<RouterContext>()({
	component: Layout,
});

const homeRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: Home,
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
	path: "/f/$token",
	component: FollowUp,
});

const routeTree = rootRoute.addChildren([
	homeRoute,
	prayRoute,
	committedRoute,
	followUpRoute,
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
