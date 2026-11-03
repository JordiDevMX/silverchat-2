import { ChatContextMenu } from "@/features/chats/components/ChatContextMenu";
import { ChatFilters } from "@/features/chats/components/ChatFilters";
import { ChatListItem } from "@/features/chats/components/ChatListItem";
import { ChatSearchBar } from "@/features/chats/components/ChatSearchBar";
import { ChatsEmptyState } from "@/features/chats/components/ChatsEmptyState";
import { ChatsHeader } from "@/features/chats/components/ChatsHeader";
import { DeleteChatModal } from "@/features/chats/components/DeleteChatModal";
import { MessageRequestsSection } from "@/features/chats/components/MessageRequestsSection";
import { MultiSelectToolbar } from "@/features/chats/components/MultiSelectToolbar";
import { NewChatFAB } from "@/features/chats/components/NewChatFAB";
import { useChatsPage } from "@/features/chats/hooks/useChatsPage";
import { BlockUserModal } from "@/features/settings/components/BlockUserModal";
export function ChatsPage() {
  const {
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
    startSelection,
    confirmDeletion,
  } = useChatsPage();
  return (
    <main
      id="main"
      className="chats-page"
      data-clock={clock}
      aria-busy={query.isFetching || mutations.busy}
      {...pullHandlers}
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
            canDelete={!selected.some((chat) => chat.type === "community_chat")}
            count={selected.length}
            all={allSelected}
            busy={mutations.busy}
            onClose={closeSelection}
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
          <ChatsHeader title={t("Chats")} />
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
          onSelect={() => startSelection(menuChat.id)}
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
          onConfirm={confirmDeletion}
        />
      )}
    </main>
  );
}
