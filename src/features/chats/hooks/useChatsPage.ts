import { useRouter } from "@tanstack/react-router";
import { type TouchEvent, useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { draftEvent, readDrafts } from "@/features/chats/drafts";
import { useChatFilters } from "@/features/chats/hooks/useChatFilters";
import { useChatMutations } from "@/features/chats/hooks/useChatMutations";
import { useChats } from "@/features/chats/hooks/useChats";
import { useMessageRequests } from "@/features/chats/hooks/useMessageRequests";
import { useChatText } from "@/features/chats/i18n";
import type { Chat, ChatAction, Draft } from "@/features/chats/types";
import { applyFilter, applySearch, orderChats } from "@/features/chats/utils/computeChatDisplay";
import { useAuth } from "@/lib/auth-provider";

export function useChatsPage() {
  const t = useChatText();
  const { language } = useI18n();
  const auth = useAuth();
  const router = useRouter();
  const query = useChats(),
    requests = useMessageRequests(),
    mutations = useChatMutations(),
    filters = useChatFilters();
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const [deleting, setDeleting] = useState<Chat[]>([]);
  const [block, setBlock] = useState<Chat | null>(null);
  const [fab, setFab] = useState(false);
  const [pull, setPull] = useState(0);
  const [clock, setClock] = useState(0);
  const [, setDraftVersion] = useState(0);
  const pullOrigin = useRef<{ x: number; y: number } | null>(null);
  const anchor = useRef<string | null>(null);
  useEffect(() => {
    const tick = setInterval(() => setClock((c) => c + 1), 30000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    const refresh = () => setDraftVersion((v) => v + 1);
    window.addEventListener("storage", refresh);
    window.addEventListener(draftEvent, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(draftEvent, refresh);
    };
  }, []);
  let drafts = new Map<string, Draft>();
  try {
    drafts = readDrafts(localStorage, auth.user?.id);
  } catch {
    /* Optional storage. */
  }
  const chats = query.data ?? [];
  const visible = orderChats(applySearch(applyFilter(chats, filters.filter), filters.q));
  const selectedIds = new Set(filters.select ? filters.selectedIds.split(",") : []);
  const selected = chats.filter((c) => selectedIds.has(c.id));
  const allSelected = visible.length > 0 && visible.every((c) => selectedIds.has(c.id));
  const menuChat = chats.find((c) => c.id === menu?.id);
  const refresh = () => Promise.all([query.refetch(), requests.refetch()]);
  const action = (targets: Chat[], kind: ChatAction, until?: string | null) => {
    if (mutations.busy) return;
    if (kind === "delete") {
      setDeleting(targets);
      return;
    }
    void mutations.run(targets, kind, until);
  };
  const toggle = (id: string, shift: boolean) => {
    const next = new Set(selectedIds);
    const a = visible.findIndex((c) => c.id === anchor.current),
      b = visible.findIndex((c) => c.id === id);
    if (shift && a >= 0 && b >= 0) {
      for (const c of visible.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(c.id);
    } else if (next.has(id)) next.delete(id);
    else next.add(id);
    anchor.current = id;
    filters.update({ selectedIds: [...next].filter(Boolean).join(",") }, true);
  };
  const showRequests = filters.filter === "all" || filters.filter === "unread";
  const pullHandlers = {
    onTouchStart: (e: TouchEvent<HTMLElement>) => {
      const touch = e.touches[0];
      if (window.scrollY === 0 && touch && !(e.target instanceof HTMLInputElement))
        pullOrigin.current = { x: touch.clientX, y: touch.clientY };
    },
    onTouchMove: (e: TouchEvent<HTMLElement>) => {
      const touch = e.touches[0],
        start = pullOrigin.current;
      if (!start || !touch) return;
      const dx = touch.clientX - start.x,
        dy = touch.clientY - start.y;
      if (Math.abs(dx) > 20) {
        pullOrigin.current = null;
        setPull(0);
        return;
      }
      setPull(Math.max(0, Math.min(85, dy / 2)));
    },
    onTouchEnd: () => {
      if (pull > 60) void refresh();
      pullOrigin.current = null;
      setPull(0);
    },
    onTouchCancel: () => {
      pullOrigin.current = null;
      setPull(0);
    },
  };
  const closeSelection = () => {
    filters.update({ select: undefined, selectedIds: "" });
    anchor.current = null;
  };
  const confirmDeletion = () => {
    void mutations.run(deleting, "delete").then((success) => {
      if (success) {
        setDeleting([]);
        filters.update({ selectedIds: "" }, true);
      } else setDeleting((current) => current.filter((c) => mutations.failedIds.current.has(c.id)));
    });
  };
  return {
    t,
    language,
    auth,
    router,
    query,
    requests,
    mutations,
    filters,
    menu,
    setMenu,
    closeMenu,
    deleting,
    setDeleting,
    block,
    setBlock,
    fab,
    setFab,
    pull,
    clock,
    anchor,
    drafts,
    visible,
    selectedIds,
    selected,
    allSelected,
    menuChat,
    refresh,
    action,
    toggle,
    showRequests,
    pullHandlers,
    closeSelection,
    confirmDeletion,
  };
}
