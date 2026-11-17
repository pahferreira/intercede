import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

export function renderWithRouter(ui: ReactNode) {
	const router = createRouter({
		routeTree: createRootRoute({ component: () => ui }),
		history: createMemoryHistory(),
	});
	return render(<RouterProvider router={router} />);
}
