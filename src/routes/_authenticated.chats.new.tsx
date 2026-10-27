import { useRouter } from "@tanstack/react-router";
import { ArrowLeft, MessageSquarePlus, Search, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { useCreateDirectChat } from "@/features/chats/hooks/useCreateDirectChat";
import {
  type UserSearchResult,
  useDirectContacts,
  useUserSearch,
} from "@/features/chats/hooks/useUserSearch";
import { useChatText } from "@/features/chats/i18n";
import { Avatar } from "@/features/settings/components/shared";

export function NewChatPage() {
  const t = useChatText();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const contacts = useDirectContacts();
  const search = useUserSearch(query);
  const createDirectChat = useCreateDirectChat();
  const clearNotice = useChatUIStore((s) => s.notify);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (createDirectChat.errorMessage) {
          createDirectChat.clearError();
          clearNotice("");
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createDirectChat, clearNotice]);

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;

  const renderUserRow = (user: UserSearchResult, onSelect: () => void, disabled: boolean) => (
    <li key={user.id} className="new-chat-user-item">
      <button type="button" className="new-chat-user-row" disabled={disabled} onClick={onSelect}>
        <span className="chat-avatar">
          <Avatar profile={user} size="medium" />
        </span>
        <span className="new-chat-user-copy">
          <span className="new-chat-user-identity">
            <strong className="new-chat-user-name">{user.display_name}</strong>
            <small className="new-chat-user-handle">@{user.username}</small>
          </span>
          {user.bio && <span className="new-chat-user-bio">{user.bio}</span>}
        </span>
        <span className="new-chat-action-pill">{t("Message")}</span>
      </button>
    </li>
  );

  return (
    <main id="main" className="chats-page">
      <div className="chats-surface new-chat-surface">
        <header className="new-chat-header">
          <button
            type="button"
            className="new-chat-back"
            aria-label={t("Back to chats")}
            onClick={() => void router.navigate({ href: "/chats" })}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="new-chat-header-titles">
            <h1 className="new-chat-heading">{t("New chat")}</h1>
          </div>
        </header>

        <div className="chat-search new-chat-search">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            aria-label={t("Search by name or @username")}
            placeholder={t("Search by name or @username")}
            onChange={(event) => {
              setQuery(event.target.value);
              if (createDirectChat.errorMessage) {
                createDirectChat.clearError();
              }
            }}
          />
          {query && (
            <button
              type="button"
              aria-label={t("Clear search")}
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {createDirectChat.errorMessage && (
          <div className="chats-error new-chat-alert" role="alert">
            <span>{createDirectChat.errorMessage}</span>
            <button
              type="button"
              className="new-chat-alert-dismiss"
              aria-label={t("Dismiss")}
              onClick={() => {
                createDirectChat.clearError();
                clearNotice("");
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {!isSearching ? (
          <section className="new-chat-section" aria-label={t("Contacts")}>
            <h2 className="new-chat-section-title">{t("Contacts")}</h2>
            {contacts.isPending ? (
              <div className="chat-skeleton" role="status" aria-label={t("Loading contacts…")}>
                {[0, 1, 2].map((n) => (
                  <div key={n}>
                    <span />
                    <i />
                  </div>
                ))}
              </div>
            ) : contacts.isError ? (
              <div className="chats-error" role="alert">
                <p>{t("Could not load contacts.")}</p>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void contacts.refetch()}
                >
                  {t("Try again")}
                </button>
              </div>
            ) : contacts.data && contacts.data.length > 0 ? (
              <ul className="new-chat-user-list">
                {contacts.data.map((contact) =>
                  renderUserRow(
                    contact.user,
                    () => void router.navigate({ href: `/chats/${contact.chatId}` }),
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
              <div className="chat-skeleton" role="status" aria-label={t("Searching users…")}>
                {[0, 1, 2].map((n) => (
                  <div key={n}>
                    <span />
                    <i />
                  </div>
                ))}
              </div>
            ) : search.isError ? (
              <div className="chats-error" role="alert">
                <p>{t("Could not search users. Please try again.")}</p>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void search.refetch()}
                >
                  {t("Try again")}
                </button>
              </div>
            ) : search.results.length > 0 ? (
              <ul className="new-chat-user-list">
                {search.results.map((user) => {
                  const existingContact = contacts.data?.find((c) => c.user.id === user.id);
                  return renderUserRow(
                    user,
                    () => {
                      if (existingContact) {
                        void router.navigate({ href: `/chats/${existingContact.chatId}` });
                      } else {
                        createDirectChat.mutate(user.id);
                      }
                    },
                    createDirectChat.isPending,
                  );
                })}
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
