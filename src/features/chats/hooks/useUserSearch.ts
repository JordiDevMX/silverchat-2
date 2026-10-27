import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";

export interface UserSearchResult {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
}

export interface DirectContactItem {
  chatId: string;
  user: UserSearchResult;
}

export function sanitizeUserSearchTerm(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

export function escapeIlikePattern(term: string): string {
  return sanitizeUserSearchTerm(term).replace(/[\\%_,"().]/g, (match) => `\\${match}`);
}

export function matchesUserFilter(user: UserSearchResult, rawQuery: string): boolean {
  const q = sanitizeUserSearchTerm(rawQuery).toLocaleLowerCase();
  if (!q) return true;
  if (
    user.display_name.toLocaleLowerCase().includes(q) ||
    user.username.toLocaleLowerCase().includes(q)
  ) {
    return true;
  }
  const hexMatch = q.match(/^(?:user_)?([0-9a-f]{4,8})$/i);
  if (hexMatch?.[1] && user.id.toLocaleLowerCase().startsWith(hexMatch[1].toLocaleLowerCase())) {
    return true;
  }
  return false;
}

export function buildUserSearchOrFilter(raw: string): string {
  const stripped = sanitizeUserSearchTerm(raw);
  const escaped = escapeIlikePattern(raw);
  const clauses = [`username.ilike.%${escaped}%`, `display_name.ilike.%${escaped}%`];
  const hexMatch = stripped.match(/^(?:user_)?([0-9a-f]{4,8})$/i);
  if (hexMatch?.[1]) {
    const hex = hexMatch[1].toLowerCase();
    const minUuid = `${hex.padEnd(8, "0")}-0000-0000-0000-000000000000`;
    const maxUuid = `${hex.padEnd(8, "f")}-ffff-ffff-ffff-ffffffffffff`;
    clauses.push(`and(id.gte.${minUuid},id.lte.${maxUuid})`);
  }
  return clauses.join(",");
}

export function useUserSearch(rawQuery: string, debounceMs = 300) {
  const { user, mfaRequired } = useAuth();
  const immediateSanitized = sanitizeUserSearchTerm(rawQuery);
  const [debouncedTerm, setDebouncedTerm] = useState(immediateSanitized);

  useEffect(() => {
    if (!immediateSanitized) {
      setDebouncedTerm("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedTerm(immediateSanitized);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [immediateSanitized, debounceMs]);

  const isDebouncing = immediateSanitized !== debouncedTerm;

  const query = useQuery({
    queryKey: ["user-search", user?.id ?? "", debouncedTerm],
    enabled: Boolean(user && !mfaRequired && debouncedTerm.length > 0),
    staleTime: 15_000,
    queryFn: async (): Promise<UserSearchResult[]> => {
      const currentUserId = user?.id ?? "";
      if (!currentUserId || !debouncedTerm) return [];

      const orFilter = buildUserSearchOrFilter(debouncedTerm);

      const [profilesRes, blocksRes] = await Promise.all([
        supabase
          .from("profiles_visible")
          .select("id, username, display_name, avatar_url, bio")
          .neq("id", currentUserId)
          .or(orFilter)
          .order("display_name", { ascending: true })
          .order("username", { ascending: true })
          .limit(20),
        supabase.from("user_blocks").select("blocked_id").eq("blocker_id", currentUserId),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (blocksRes.error) throw blocksRes.error;

      const blockedIds = new Set((blocksRes.data ?? []).map((b) => b.blocked_id));
      const results: UserSearchResult[] = [];

      for (const row of profilesRes.data ?? []) {
        if (!row.id || row.id === currentUserId || blockedIds.has(row.id)) continue;
        results.push({
          id: row.id,
          username: row.username ?? "",
          display_name: row.display_name ?? row.username ?? "",
          avatar_url: row.avatar_url ?? null,
          bio: row.bio ?? null,
        });
      }

      return results;
    },
  });

  return {
    ...query,
    results: immediateSanitized ? (query.data ?? []) : [],
    debouncedTerm,
    isDebouncing,
    isLoading: Boolean(immediateSanitized) && (isDebouncing || query.isPending || query.isFetching),
    hasQuery: Boolean(immediateSanitized),
  };
}

export function useDirectContacts() {
  const { user, mfaRequired } = useAuth();

  return useQuery({
    queryKey: ["direct-contacts", user?.id ?? ""],
    enabled: Boolean(user && !mfaRequired),
    staleTime: 15_000,
    queryFn: async (): Promise<DirectContactItem[]> => {
      const currentUserId = user?.id ?? "";
      if (!currentUserId) return [];

      const membershipsRes = await supabase
        .from("chat_members")
        .select(
          "chat_id, chat:chats!chat_members_chat_id_fkey!inner(id, type, status, direct_pair_key, last_message_at)",
        )
        .eq("user_id", currentUserId)
        .eq("chat.type", "direct")
        .eq("chat.status", "active")
        .order("chat(last_message_at)", { ascending: false, nullsFirst: false })
        .limit(200);

      if (membershipsRes.error) throw membershipsRes.error;

      const memberships = membershipsRes.data ?? [];
      if (!memberships.length) return [];

      const chatIds = memberships.map((m) => m.chat_id);

      const [membersRes, blocksRes] = await Promise.all([
        supabase
          .from("chat_members")
          .select("chat_id, user_id")
          .in("chat_id", chatIds)
          .neq("user_id", currentUserId),
        supabase.from("user_blocks").select("blocked_id").eq("blocker_id", currentUserId),
      ]);

      if (membersRes.error) throw membersRes.error;
      if (blocksRes.error) throw blocksRes.error;

      const blockedIds = new Set((blocksRes.data ?? []).map((b) => b.blocked_id));
      const chatToUser = new Map<string, string>();

      for (const m of memberships) {
        const pairOther = m.chat.direct_pair_key
          ?.split("::")
          .find((id) => id && id !== currentUserId);
        const memberOther = (membersRes.data ?? []).find(
          (row) => row.chat_id === m.chat_id && row.user_id !== currentUserId,
        )?.user_id;
        const otherId = pairOther ?? memberOther;
        if (otherId && !blockedIds.has(otherId)) {
          chatToUser.set(m.chat_id, otherId);
        }
      }

      const otherUserIds = [...new Set(chatToUser.values())];
      if (!otherUserIds.length) return [];

      const profilesRes = await supabase
        .from("profiles_visible")
        .select("id, username, display_name, avatar_url, bio")
        .in("id", otherUserIds);

      if (profilesRes.error) throw profilesRes.error;

      const profileById = new Map<string, UserSearchResult>();
      for (const row of profilesRes.data ?? []) {
        if (!row.id || row.id === currentUserId || blockedIds.has(row.id)) continue;
        profileById.set(row.id, {
          id: row.id,
          username: row.username ?? "",
          display_name: row.display_name ?? row.username ?? "",
          avatar_url: row.avatar_url ?? null,
          bio: row.bio ?? null,
        });
      }

      const seenUsers = new Set<string>();
      const contacts: DirectContactItem[] = [];

      for (const m of memberships) {
        const otherId = chatToUser.get(m.chat_id);
        if (!otherId || seenUsers.has(otherId)) continue;
        const profile = profileById.get(otherId);
        if (!profile) continue;
        seenUsers.add(otherId);
        contacts.push({
          chatId: m.chat_id,
          user: profile,
        });
      }

      contacts.sort((a, b) => a.user.display_name.localeCompare(b.user.display_name));
      return contacts;
    },
  });
}
