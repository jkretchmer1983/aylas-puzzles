import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { routerShouldRestoreScroll } from "./lib/scroll-ownership";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // Never re-applied over the visitor's own scroll after hydration or over the menu's one-time return restore.
    scrollRestoration: ({ location }) => routerShouldRestoreScroll(location.pathname),
    defaultPreloadStaleTime: 0,
  });

  return router;
};
