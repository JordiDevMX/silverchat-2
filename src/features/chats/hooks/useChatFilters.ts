import { useRouter, useRouterState } from "@tanstack/react-router";
import { validateChatSearch } from "../utils/chatSearch";
export function useChatFilters() {
  const search = validateChatSearch(useRouterState({ select: (state) => state.location.search }));
  const router = useRouter();
  const update = (patch: Partial<typeof search>, replace = false) => {
    // Debounced search / async mutations must preserve navigation since scheduling.
    const next = { ...validateChatSearch(router.state.location.search), ...patch };
    const { pathname, searchStr } = router.state.location;
    const params = new URLSearchParams(searchStr);
    for (const key of ["filter", "q", "select", "selectedIds", "notice"]) params.delete(key);
    if (next.filter !== "all") params.set("filter", next.filter);
    if (next.q) params.set("q", next.q);
    if (next.select) params.set("select", "true");
    if (next.select && next.selectedIds) params.set("selectedIds", next.selectedIds);
    void router.navigate({ href: `${pathname}${params.size ? `?${params}` : ""}`, replace });
  };
  return { ...search, update };
}
