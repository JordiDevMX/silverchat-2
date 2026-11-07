import { useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { useAuth } from "@/lib/auth-provider";
import { useChatText } from "../i18n";
import { useCreateGroupChat } from "./useCreateGroupChat";
import {
  matchesUserFilter,
  sanitizeUserSearchTerm,
  type UserSearchResult,
  useDirectContacts,
  useUserSearch,
} from "./useUserSearch";
export const MAX_GROUP_MEMBERS = 100;

export function useNewGroupPage() {
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
    return list.filter((u) => matchesUserFilter(u, searchQuery));
  }, [contacts.data, currentUserId, normalizedFilter, searchQuery]);

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

  const changeName = (value: string) => {
    setGroupName(value);
    if (localError) setLocalError(null);
    if (createGroup.errorMessage) createGroup.clearError();
  };
  const dismissError = () => {
    setLocalError(null);
    createGroup.clearError();
    notify("");
  };
  const activeError = localError ?? createGroup.errorMessage;

  return {
    changeName,
    dismissError,
    t,
    router,
    groupName,
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
  };
}
