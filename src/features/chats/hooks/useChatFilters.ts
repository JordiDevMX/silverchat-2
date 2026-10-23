import { useRouter, useSearch } from "@tanstack/react-router";
import { validateChatSearch } from "../utils/chatSearch";
export function useChatFilters() {
  const search = validateChatSearch(useSearch({ strict: false }) as Record<string, unknown>);
  const router = useRouter();
  const update = (patch: Partial<typeof search>, replace = false) => {
    // Debounced search / async mutations must preserve navigation since scheduling.
    const next = { ...validateChatSearch(router.state.location.search), ...patch };
    const params = new URLSearchParams();
    if (next.filter !== "all") params.set("filter", next.filter);
    if (next.q) params.set("q", next.q);
    if (next.select) params.set("select", "true");
    if (next.select && next.selectedIds) params.set("selectedIds", next.selectedIds);
    void router.navigate({ href: `/chats${params.size ? `?${params}` : ""}`, replace });
  };
  return { ...search, update };
}
