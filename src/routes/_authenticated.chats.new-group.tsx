import { ArrowLeft, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatContactRow, ChatListSkeleton } from "@/features/chats/components/ChatPickerSurfaces";
import { MAX_GROUP_MEMBERS, useNewGroupPage } from "@/features/chats/hooks/useNewGroupPage";
import type { UserSearchResult } from "@/features/chats/hooks/useUserSearch";
import { Avatar } from "@/features/settings/components/shared";

export function NewGroupPage() {
  const {
    t,
    router,
    dismissError,
    groupName,
    changeName,
    searchQuery,
    setSearchQuery,
    selectedMap,
    contacts,
    search,
    createGroup,
    trimmedName,
    selectedUsers,
    isValid,
    contactCandidates,
    searchCandidates,
    toggleCandidate,
    removeSelected,
    handleSubmit,
    activeError,
  } = useNewGroupPage();
  const renderCandidateRow = (candidate: UserSearchResult) => (
    <ChatContactRow
      key={candidate.id}
      avatar={<Avatar profile={candidate} size="medium" />}
      name={candidate.display_name}
      username={candidate.username}
      bio={candidate.bio}
      disabled={createGroup.isPending}
      checked={selectedMap.has(candidate.id)}
      onSelect={() => toggleCandidate(candidate)}
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
            <h1 className="new-chat-heading">{t("New group")}</h1>
          </div>
          <Button
            type="button"
            className="new-group-create-btn"
            disabled={!isValid || createGroup.isPending}
            onClick={handleSubmit}
          >
            {createGroup.isPending ? t("Working…") : t("Create")}
          </Button>
        </header>

        <div className="new-group-form">
          <div className="new-group-field">
            <label htmlFor="new-group-name-input" className="new-group-label">
              <span>{t("Group name")}</span>
              <small className="new-group-counter">{trimmedName.length}/100</small>
            </label>
            <Input
              id="new-group-name-input"
              type="text"
              className="new-group-name-input"
              maxLength={100}
              required
              disabled={createGroup.isPending}
              placeholder={t("Enter group name…")}
              value={groupName}
              onChange={(event) => changeName(event.target.value)}
            />
          </div>

          {activeError && (
            <div className="chats-error new-chat-alert" role="alert">
              <span>{activeError}</span>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className="new-group-chip-remove"
                      disabled={createGroup.isPending}
                      aria-label={`${t("Remove")} ${member.display_name}`}
                      onClick={() => removeSelected(member.id)}
                    >
                      <X size={14} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="chat-search new-chat-search">
              <Search size={18} aria-hidden="true" />
              <Input
                type="search"
                value={searchQuery}
                aria-label={t("Search by name or @username")}
                placeholder={t("Search by name or @username")}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  type="button"
                  aria-label={t("Clear search")}
                  onClick={() => setSearchQuery("")}
                >
                  <X size={16} />
                </Button>
              )}
            </div>

            {contacts.isPending && !search.hasQuery ? (
              <ChatListSkeleton label={t("Loading contacts…")} count={3} />
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
                      <ChatListSkeleton label={t("Searching users…")} count={3} />
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
