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

export interface DirectContact {
  chatId: string;
  user: UserSearchResult;
}

export function sanitizeUserSearchTerm(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .replace(/[^\p{L}\p{N} _.-]/gu, "")
    .trim();
}

function normalizeProfileRow(row: {
  id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}): UserSearchResult | null {
  if (!row.id || !row.username) return null;
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name ?? row.username,
    avatar_url: row.avatar_url ?? null,
    bio: row.bio ?? null,
  };
}

export function useUserSearch(query: string) {
  const { user, mfaRequired } = useAuth();
  const userId = user?.id ?? "";
  const cleanedImmediate = sanitizeUserSearchTerm(query);
  const [debouncedTerm, setDebouncedTerm] = useState(cleanedImmediate);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(sanitizeUserSearchTerm(query));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const searchQuery = useQuery({
    queryKey: ["user-search", userId, debouncedTerm],
    enabled: Boolean(userId && !mfaRequired && debouncedTerm.length > 0),
    queryFn: async (): Promise<UserSearchResult[]> => {
      const escaped = debouncedTerm.replace(/_/g, "\\_");
      const [profilesRes, blocksRes] = await Promise.all([
        supabase
          .from("profiles_visible")
          .select("id, username, display_name, avatar_url, bio")
          .neq("id", userId)
          .or(`username.ilike.%${escaped}%,display_name.ilike.%${escaped}%`)
          .order("username", { ascending: true })
          .limit(20),
        supabase
          .from("user_blocks")
          .select("blocker_id, blocked_id")
          .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const blockedIds = new Set<string>();
      for (const b of blocksRes.data ?? []) {
        if (b.blocker_id && b.blocker_id !== userId) blockedIds.add(b.blocker_id);
        if (b.blocked_id && b.blocked_id !== userId) blockedIds.add(b.blocked_id);
      }

      const results: UserSearchResult[] = [];
      for (const row of profilesRes.data ?? []) {
        const normalized = normalizeProfileRow(row);
        if (!normalized) continue;
        if (normalized.id === userId) continue;
        if (blockedIds.has(normalized.id)) continue;
        results.push(normalized);
      }
      return results;
    },
  });

  const isDebouncing = cleanedImmediate !== debouncedTerm;

  return {
    ...searchQuery,
    term: debouncedTerm,
    hasQuery: cleanedImmediate.length > 0,
    isLoading: cleanedImmediate.length > 0 && (isDebouncing || searchQuery.isFetching),
    results: cleanedImmediate.length > 0 ? (searchQuery.data ?? []) : [],
  };
}

export function useDirectContacts() {
  const { user, mfaRequired } = useAuth();
  const userId = user?.id ?? "";

  return useQuery({
    queryKey: ["direct-contacts", userId],
    enabled: Boolean(userId && !mfaRequired),
    queryFn: async (): Promise<DirectContact[]> => {
      const mine = await supabase
        .from("chat_members")
        .select("chat_id, chats!inner(id, type, status, direct_pair_key)")
        .eq("user_id", userId)
        .eq("chats.type", "direct")
        .eq("chats.status", "active");

      if (mine.error) throw mine.error;
      if (!mine.data?.length) return [];

      const chatByOtherUser = new Map<string, string>();
      const missingChatIds: string[] = [];

      for (const row of mine.data) {
        const pairKey = row.chats?.direct_pair_key;
        const otherFromPair = pairKey?.split("::").find((id) => id && id !== userId);
        if (otherFromPair) {
          chatByOtherUser.set(otherFromPair, row.chat_id);
        } else {
          missingChatIds.push(row.chat_id);
        }
      }

      if (missingChatIds.length > 0) {
        const members = await supabase
          .from("chat_members")
          .select("chat_id, user_id")
          .in("chat_id", missingChatIds)
          .neq("user_id", userId);
        if (members.error) throw members.error;
        for (const m of members.data ?? []) {
          if (m.user_id && !chatByOtherUser.has(m.user_id)) {
            chatByOtherUser.set(m.user_id, m.chat_id);
          }
        }
      }

      const targetIds = [...chatByOtherUser.keys()];
      if (!targetIds.length) return [];

      const [profilesRes, blocksRes] = await Promise.all([
        supabase
          .from("profiles_visible")
          .select("id, username, display_name, avatar_url, bio")
          .in("id", targetIds)
          .order("display_name", { ascending: true }),
        supabase
          .from("user_blocks")
          .select("blocker_id, blocked_id")
          .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const blockedIds = new Set<string>();
      for (const b of blocksRes.data ?? []) {
        if (b.blocker_id && b.blocker_id !== userId) blockedIds.add(b.blocker_id);
        if (b.blocked_id && b.blocked_id !== userId) blockedIds.add(b.blocked_id);
      }

      const contacts: DirectContact[] = [];
      for (const row of profilesRes.data ?? []) {
        const normalized = normalizeProfileRow(row);
        if (!normalized || blockedIds.has(normalized.id)) continue;
        const chatId = chatByOtherUser.get(normalized.id);
        if (!chatId) continue;
        contacts.push({ chatId, user: normalized });
      }

      return contacts.sort((a, b) =>
        a.user.display_name.localeCompare(b.user.display_name, undefined, {
          sensitivity: "base",
        }),
      );
    },
  });
}

