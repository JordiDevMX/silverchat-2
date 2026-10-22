import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";

// Prompt #2 §10 — single placeholder route for now; real routes arrive in Prompt #7+.
function BootstrappingPage() {
  return <div>SilverChat — bootstrapping</div>;
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: BootstrappingPage,
});

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
