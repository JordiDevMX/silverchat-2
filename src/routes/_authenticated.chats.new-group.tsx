import { useRouter } from "@tanstack/react-router";
import { ArrowLeft, Search, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { useCreateGroupChat } from "@/features/chats/hooks/useCreateGroupChat";
import {
  sanitizeUserSearchTerm,
  type UserSearchResult,
  useDirectContacts,
  useUserSearch,
} from "@/features/chats/hooks/useUserSearch";
import { useChatText } from "@/features/chats/i18n";
import { Avatar } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";

const MAX_GROUP_MEMBERS = 100;

export function NewGroupPage() {
  const t = useChatText();
  const router = useRouter();
  const { user } = useAuth();
  const notify = useChatUIStore((s) => s.notify);

  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMap, setSelectedMap] = useState<Map<string, UserSearchResult>>(() => new Map());
  const [localError, setLocalError] = useState<string | null>(null);

  const contacts = useDirectContacts();
  const search = useUserSearch(searchQuery);
  const createGroup = useCreateGroupChat();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (localError || createGroup.errorMessage) {
          setLocalError(null);
          createGroup.clearError();
          notify("");
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [localError, createGroup, notify]);

  useEffect(() => {
    return () => {
      setGroupName("");
      setSearchQuery("");
      setSelectedMap(new Map());
      setLocalError(null);
    };
  }, []);

  const currentUserId = user?.id ?? "";
  const trimmedName = groupName.trim();
  const selectedUsers = useMemo(() => [...selectedMap.values()], [selectedMap]);
  const selectedIds = useMemo(() => [...selectedMap.keys()], [selectedMap]);

  const isValid =
    trimmedName.length >= 1 &&
    trimmedName.length <= 100 &&
    selectedIds.length >= 1 &&
    selectedIds.length <= MAX_GROUP_MEMBERS;

  const normalizedFilter = sanitizeUserSearchTerm(searchQuery).toLocaleLowerCase();

  const contactCandidates = useMemo(() => {
    const list = (contacts.data ?? []).map((c) => c.user).filter((u) => u.id !== currentUserId);
    if (!normalizedFilter) return list;
    return list.filter(
      (u) =>
        u.display_name.toLocaleLowerCase().includes(normalizedFilter) ||
        u.username.toLocaleLowerCase().includes(normalizedFilter),
    );
  }, [contacts.data, currentUserId, normalizedFilter]);

  const contactIds = useMemo(
    () => new Set(contactCandidates.map((u) => u.id)),
    [contactCandidates],
  );

  const searchCandidates = useMemo(() => {
    if (!search.hasQuery) return [];
    return search.results.filter((u) => u.id !== currentUserId && !contactIds.has(u.id));
  }, [search.hasQuery, search.results, currentUserId, contactIds]);

  const toggleCandidate = (candidate: UserSearchResult) => {
    if (!candidate.id || candidate.id === currentUserId) return;
    setLocalError(null);
    if (createGroup.errorMessage) createGroup.clearError();

    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(candidate.id)) {
        next.delete(candidate.id);
        return next;
      }
      if (next.size >= MAX_GROUP_MEMBERS) {
        const msg = t("You can select up to 100 members");
        setLocalError(msg);
        notify(msg);
        return prev;
      }
      next.set(candidate.id, candidate);
      return next;
    });
  };

  const removeSelected = (userId: string) => {
    setLocalError(null);
    setSelectedMap((prev) => {
      if (!prev.has(userId)) return prev;
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  };

  const handleSubmit = () => {
    if (createGroup.isPending) return;
    setLocalError(null);
    createGroup.mutate({
      name: groupName,
      memberIds: selectedIds,
    });
  };

  const activeError = localError ?? createGroup.errorMessage;

  const renderCandidateRow = (candidate: UserSearchResult) => {
    const checked = selectedMap.has(candidate.id);
    return (
      <li key={candidate.id} className="new-chat-user-item">
        <label className={`new-group-candidate-row ${checked ? "is-checked" : ""}`}>
          <input
            type="checkbox"
            className="new-group-candidate-checkbox"
            checked={checked}
            disabled={createGroup.isPending}
            onChange={() => toggleCandidate(candidate)}
          />
          <span className="chat-avatar">
            <Avatar profile={candidate} size="medium" />
          </span>
          <span className="new-chat-user-copy">
            <span className="new-chat-user-identity">
              <strong className="new-chat-user-name">{candidate.display_name}</strong>
              <small className="new-chat-user-handle">@{candidate.username}</small>
            </span>
            {candidate.bio && <span className="new-chat-user-bio">{candidate.bio}</span>}
          </span>
        </label>
      </li>
    );
  };

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
            <h1 className="new-chat-heading">{t("New group")}</h1>
          </div>
          <button
            type="button"
            className="button primary new-group-create-btn"
            disabled={!isValid || createGroup.isPending}
            onClick={handleSubmit}
          >
            {createGroup.isPending ? t("Working…") : t("Create")}
          </button>
        </header>

        <div className="new-group-form">
          <div className="new-group-field">
            <label htmlFor="new-group-name-input" className="new-group-label">
              <span>{t("Group name")}</span>
              <small className="new-group-counter">{trimmedName.length}/100</small>
            </label>
            <input
              id="new-group-name-input"
              type="text"
              className="new-group-name-input"
              maxLength={100}
              required
              disabled={createGroup.isPending}
              placeholder={t("Enter group name…")}
              value={groupName}
              onChange={(event) => {
                setGroupName(event.target.value);
                if (localError) setLocalError(null);
                if (createGroup.errorMessage) createGroup.clearError();
              }}
            />
          </div>

          {activeError && (
            <div className="chats-error new-chat-alert" role="alert">
              <span>{activeError}</span>
              <button
                type="button"
                className="new-chat-alert-dismiss"
                aria-label={t("Dismiss")}
                onClick={() => {
                  setLocalError(null);
                  createGroup.clearError();
                  notify("");
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          <section className="new-group-members-section" aria-label={t("Members")}>
            <div className="new-group-members-header">
              <h2 className="new-chat-section-title">{t("Members")}</h2>
              <span className="new-group-selected-count">
                {selectedUsers.length}/{MAX_GROUP_MEMBERS} {t("selected")}
              </span>
            </div>

            {selectedUsers.length > 0 && (
              <ul className="new-group-chips" aria-label={t("Selected members")}>
                {selectedUsers.map((member) => (
                  <li key={member.id} className="new-group-chip">
                    <Avatar profile={member} size="small" />
                    <span className="new-group-chip-name">{member.display_name}</span>
                    <button
                      type="button"
                      className="new-group-chip-remove"
                      disabled={createGroup.isPending}
                      aria-label={`${t("Remove")} ${member.display_name}`}
                      onClick={() => removeSelected(member.id)}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="chat-search new-chat-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                aria-label={t("Search by name or @username")}
                placeholder={t("Search by name or @username")}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label={t("Clear search")}
                  onClick={() => setSearchQuery("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {contacts.isPending && !search.hasQuery ? (
              <div className="chat-skeleton" role="status" aria-label={t("Loading contacts…")}>
                {[0, 1, 2].map((n) => (
                  <div key={n}>
                    <span />
                    <i />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {contactCandidates.length > 0 && (
                  <div className="new-group-candidate-group">
                    <h3 className="new-group-subtitle">{t("Contacts")}</h3>
                    <ul className="new-chat-user-list">
                      {contactCandidates.map(renderCandidateRow)}
                    </ul>
                  </div>
                )}

                {search.hasQuery && (
                  <div className="new-group-candidate-group">
                    <h3 className="new-group-subtitle">{t("Search results")}</h3>
                    {search.isLoading ? (
                      <div
                        className="chat-skeleton"
                        role="status"
                        aria-label={t("Searching users…")}
                      >
                        {[0, 1, 2].map((n) => (
                          <div key={n}>
                            <span />
                            <i />
                          </div>
                        ))}
                      </div>
                    ) : searchCandidates.length > 0 ? (
                      <ul className="new-chat-user-list">
                        {searchCandidates.map(renderCandidateRow)}
                      </ul>
                    ) : (
                      contactCandidates.length === 0 && (
                        <div className="chats-empty new-chat-empty">
                          <Users size={44} aria-hidden="true" />
                          <p>{`${t("No users found for")} '${searchQuery.trim()}'`}</p>
                        </div>
                      )
                    )}
                  </div>
                )}

                {!search.hasQuery && contactCandidates.length === 0 && !contacts.isPending && (
                  <div className="chats-empty new-chat-empty">
                    <Users size={44} aria-hidden="true" />
                    <p>
                      {t(
                        "You don't have any contacts yet. Search by username to add group members.",
                      )}
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
