import { ArrowLeft, MessageSquarePlus, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatContactRow, ChatListSkeleton } from "@/features/chats/components/ChatPickerSurfaces";
import { useNewChatPage } from "@/features/chats/hooks/useNewChatPage";
import type { UserSearchResult } from "@/features/chats/hooks/useUserSearch";
import { Avatar } from "@/features/settings/components/shared";

export function NewChatPage() {
  const {
    t,
    router,
    inputRef,
    query,
    setQuery,
    contacts,
    search,
    createDirectChat,
    openContact,
    chooseResult,
    changeQuery,
    dismissError,
    trimmedQuery,
    isSearching,
  } = useNewChatPage();
  const renderUserRow = (user: UserSearchResult, onSelect: () => void, disabled: boolean) => (
    <ChatContactRow
      key={user.id}
      avatar={<Avatar profile={user} size="medium" />}
      name={user.display_name}
      username={user.username}
      bio={user.bio}
      disabled={disabled}
      onSelect={onSelect}
      actionLabel={t("Message")}
    />
  );

  return (
    <main id="main" className="chats-page">
      <div className="chats-surface new-chat-surface">
        <header className="new-chat-header">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="new-chat-back"
            aria-label={t("Back to chats")}
            onClick={() => void router.navigate({ href: "/chats" })}
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="new-chat-header-titles">
            <h1 className="new-chat-heading">{t("New chat")}</h1>
          </div>
        </header>

        <div className="chat-search new-chat-search">
          <Search size={18} aria-hidden="true" />
          <Input
            ref={inputRef}
            type="search"
            value={query}
            aria-label={t("Search by name or @username")}
            placeholder={t("Search by name or @username")}
            onChange={(event) => changeQuery(event.target.value)}
          />
          {query && (
            <Button
              variant="ghost"
              type="button"
              aria-label={t("Clear search")}
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <X size={16} />
            </Button>
          )}
        </div>

        {createDirectChat.errorMessage && (
          <div className="chats-error new-chat-alert" role="alert">
            <span>{createDirectChat.errorMessage}</span>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="new-chat-alert-dismiss"
              aria-label={t("Dismiss")}
              onClick={dismissError}
            >
              <X size={16} />
            </Button>
          </div>
        )}

        {!isSearching ? (
          <section className="new-chat-section" aria-label={t("Contacts")}>
            <h2 className="new-chat-section-title">{t("Contacts")}</h2>
            {contacts.isPending ? (
              <ChatListSkeleton label={t("Loading contacts…")} count={3} />
            ) : contacts.isError ? (
              <div className="chats-error" role="alert">
                <p>{t("Could not load contacts.")}</p>
                <Button type="button" variant="outline" onClick={() => void contacts.refetch()}>
                  {t("Try again")}
                </Button>
              </div>
            ) : contacts.data && contacts.data.length > 0 ? (
              <ul className="new-chat-user-list">
                {contacts.data.map((contact) =>
                  renderUserRow(
                    contact.user,
                    () => openContact(contact.chatId),
                    createDirectChat.isPending,
                  ),
                )}
              </ul>
            ) : (
              <div className="chats-empty new-chat-empty">
                <Users size={44} aria-hidden="true" />
                <p>
                  {t(
                    "You don't have any contacts yet. Search by username to start a new conversation.",
                  )}
                </p>
              </div>
            )}
          </section>
        ) : (
          <section className="new-chat-section" aria-label={t("Search results")}>
            <h2 className="new-chat-section-title">{t("Search results")}</h2>
            {search.isLoading ? (
              <ChatListSkeleton label={t("Searching users…")} count={3} />
            ) : search.isError ? (
              <div className="chats-error" role="alert">
                <p>{t("Could not search users. Please try again.")}</p>
                <Button type="button" variant="outline" onClick={() => void search.refetch()}>
                  {t("Try again")}
                </Button>
              </div>
            ) : search.results.length > 0 ? (
              <ul className="new-chat-user-list">
                {search.results.map((user) =>
                  renderUserRow(user, () => chooseResult(user.id), createDirectChat.isPending),
                )}
              </ul>
            ) : (
              <div className="chats-empty new-chat-empty">
                <MessageSquarePlus size={44} aria-hidden="true" />
                <p>{`${t("No users found for")} '${trimmedQuery}'`}</p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
