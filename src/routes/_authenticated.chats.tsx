import { useRouter } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { ChatContextMenu } from "@/features/chats/components/ChatContextMenu";
import { ChatFilters } from "@/features/chats/components/ChatFilters";
import { ChatListItem } from "@/features/chats/components/ChatListItem";
import { ChatSearchBar } from "@/features/chats/components/ChatSearchBar";
import { ChatsEmptyState } from "@/features/chats/components/ChatsEmptyState";
import { DeleteChatModal } from "@/features/chats/components/DeleteChatModal";
import { MessageRequestsSection } from "@/features/chats/components/MessageRequestsSection";
import { MultiSelectToolbar } from "@/features/chats/components/MultiSelectToolbar";
import { NewChatFAB } from "@/features/chats/components/NewChatFAB";
import { draftEvent, readDrafts } from "@/features/chats/drafts";
import { useChatFilters } from "@/features/chats/hooks/useChatFilters";
import { useChatMutations } from "@/features/chats/hooks/useChatMutations";
import { useChats } from "@/features/chats/hooks/useChats";
import { useMessageRequests } from "@/features/chats/hooks/useMessageRequests";
import { useChatText } from "@/features/chats/i18n";
import type { Chat, ChatAction, Draft } from "@/features/chats/types";
import { applyFilter, applySearch, orderChats } from "@/features/chats/utils/computeChatDisplay";
import { BlockUserModal } from "@/features/settings/components/BlockUserModal";
import { useAuth } from "@/lib/auth-provider";

export function ChatsPage() {
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
  return (
    <main
      id="main"
      className="chats-page"
      data-clock={clock}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        if (window.scrollY === 0 && touch && !(e.target instanceof HTMLInputElement))
          pullOrigin.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchMove={(e) => {
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
      }}
      onTouchEnd={() => {
        if (pull > 60) void refresh();
        pullOrigin.current = null;
        setPull(0);
      }}
      onTouchCancel={() => {
        pullOrigin.current = null;
        setPull(0);
      }}
    >
      {filters.notice && (
        <p role="status" className="conversation-unavailable">
          {language === "es"
            ? "Esta conversación ya no está disponible."
            : "This conversation is no longer available."}
        </p>
      )}
      <div className="chats-surface">
        {filters.select ? (
          <MultiSelectToolbar
            count={selected.length}
            all={allSelected}
            busy={mutations.busy}
            onClose={() => {
              filters.update({ select: undefined, selectedIds: "" });
              anchor.current = null;
            }}
            onAll={() =>
              filters.update(
                { selectedIds: allSelected ? "" : visible.map((c) => c.id).join(",") },
                true,
              )
            }
            onAction={(kind) =>
              action(selected, kind, kind === "mute" ? "9999-12-31T00:00:00Z" : undefined)
            }
          />
        ) : (
          <header className="chats-header">
            <div>
              <p className="chats-eyebrow">SILVERCHAT</p>
              <h1>{t("Chats")}</h1>
              <p>{t("Your conversations, together.")}</p>
            </div>
            <div className="chats-header-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => filters.update({ select: "true" })}
              >
                {t("Select")}
              </button>
              <button
                type="button"
                className="chat-refresh"
                aria-label={t("Refresh")}
                title={t("Refresh")}
                disabled={query.isFetching}
                onClick={() => void refresh()}
              >
                <RefreshCw size={20} className={query.isFetching ? "chat-spin" : ""} />
              </button>
            </div>
          </header>
        )}
        {auth.user?.user_metadata.requires_reenrollment &&
          !auth.user.factors?.some((f) => f.status === "verified") && (
            <p role="status" className="chats-notice">
              {t(
                "Backup code used. Please re-enable 2FA in settings.",
                "Usaste un código de respaldo. Reactiva 2FA en ajustes.",
              )}
            </p>
          )}
        <ChatSearchBar
          query={filters.q}
          archived={filters.filter === "archived"}
          onChange={(q) => filters.update({ q }, true)}
        />
        <ChatFilters value={filters.filter} onChange={(filter) => filters.update({ filter })} />
        {pull > 0 && (
          <p className="chat-pull" role="status">
            {t(pull > 60 ? "Release to refresh" : "Pull to refresh")}
          </p>
        )}
        {mutations.error && (
          <p className="chats-error" role="alert">
            {t("Could not update chats. Please try again.")} ({mutations.error})
          </p>
        )}
        {showRequests && <MessageRequestsSection requests={requests.data ?? []} />}
        {(query.error || (showRequests && requests.error)) && (
          <div className="chats-error" role="alert">
            <p>{t("Could not load chats.")}</p>
            <button type="button" className="button secondary" onClick={() => void refresh()}>
              {t("Try again")}
            </button>
          </div>
        )}
        {query.isPending ? (
          <div className="chat-skeleton" role="status" aria-label={t("Loading chats…")}>
            {[0, 1, 2, 3, 4].map((n) => (
              <div key={n}>
                <span />
                <i />
              </div>
            ))}
          </div>
        ) : visible.length ? (
          <ul className="chat-list">
            {visible.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                draft={drafts.get(chat.id)}
                selecting={!!filters.select}
                selected={selectedIds.has(chat.id)}
                busy={mutations.busy}
                onOpen={() => void router.navigate({ href: `/chats/${chat.id}` })}
                onSelect={(shift) => toggle(chat.id, shift)}
                onMenu={(x, y) => {
                  if (!mutations.busy) setMenu({ id: chat.id, x, y });
                }}
                onAction={(kind) => action([chat], kind)}
              />
            ))}
          </ul>
        ) : (
          !query.error &&
          !(showRequests && requests.data?.length) && (
            <ChatsEmptyState
              filter={filters.filter}
              query={filters.q}
              onNew={() => {
                if (filters.filter === "groups") void router.navigate({ href: "/chats/new-group" });
                else setFab(true);
              }}
            />
          )
        )}
      </div>
      {!filters.select && (
        <NewChatFAB open={fab} onOpen={() => setFab(true)} onClose={() => setFab(false)} />
      )}
      {menu && menuChat && (
        <ChatContextMenu
          chat={menuChat}
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
          onAction={(kind, until) => action([menuChat], kind, until)}
          onBlock={() => setBlock(menuChat)}
        />
      )}
      {block?.otherUserId && (
        <BlockUserModal
          target={{ id: block.otherUserId, display_name: block.displayName }}
          onClose={() => setBlock(null)}
        />
      )}
      {deleting.length > 0 && (
        <DeleteChatModal
          chats={deleting}
          busy={mutations.busy}
          error={mutations.error}
          onClose={() => setDeleting([])}
          onConfirm={() => {
            void mutations.run(deleting, "delete").then((success) => {
              if (success) {
                setDeleting([]);
                filters.update({ selectedIds: "" }, true);
              } else
                setDeleting((current) =>
                  current.filter((c) => mutations.failedIds.current.has(c.id)),
                );
            });
          }}
        />
      )}
    </main>
  );
}
