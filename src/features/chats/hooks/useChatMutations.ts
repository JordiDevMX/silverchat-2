import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { writeDraft } from "../drafts";
import type { Chat, ChatAction } from "../types";
import { isMuted, orderChats } from "../utils/computeChatDisplay";
import { chatKey } from "./useChats";
export function useChatMutations() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const locked = useRef(false);
  const failedIds = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (
    chats: Chat[],
    action: ChatAction,
    until?: string | null,
  ): Promise<boolean> => {
    if (!user || locked.current || !chats.length) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    failedIds.current.clear();
    const key = chatKey(user.id);
    await cache.cancelQueries({ queryKey: key });
    const before = cache.getQueryData<Chat[]>(key) ?? [];
    const stamp = new Date().toISOString();
    const patches = new Map(
      chats.map((c) => [
        c.id,
        action === "pin"
          ? { pinnedAt: c.pinnedAt ? null : stamp }
          : action === "favorite"
            ? { favoritedAt: c.favoritedAt ? null : stamp }
            : action === "archive"
              ? { archivedAt: chats.length > 1 ? stamp : c.archivedAt ? null : stamp }
              : action === "mute"
                ? {
                    mutedUntil:
                      until === undefined ? (isMuted(c) ? null : "9999-12-31T00:00:00Z") : until,
                  }
                : action === "read"
                  ? { manuallyUnread: false, unreadCount: 0 }
                  : action === "unread"
                    ? { manuallyUnread: true }
                    : {},
      ]),
    );
    cache.setQueryData<Chat[]>(key, (old) =>
      orderChats(
        (old ?? [])
          .filter((c) => action !== "delete" || !patches.has(c.id))
          .map((c) => ({ ...c, ...patches.get(c.id) })),
      ),
    );
    const results = await Promise.allSettled(
      chats.map(async (c) => {
        const patch = patches.get(c.id);
        if (action === "delete") {
          const r =
            c.type === "self"
              ? await supabase.rpc("delete_self_chat", { p_chat_id: c.id })
              : c.type === "direct"
                ? await supabase.rpc("delete_direct_chat_for_me", { p_chat_id: c.id })
                : await supabase
                    .from("chat_members")
                    .delete()
                    .eq("chat_id", c.id)
                    .eq("user_id", user.id)
                    .select("chat_id");
          if (r.error) throw r.error;
          if (Array.isArray(r.data) && !r.data.length)
            throw new Error("Membership was not removed");
          writeDraft(c.id, null);
        } else if (action === "read" || action === "unread") {
          const r = await supabase.rpc(
            action === "read" ? "mark_chat_as_read" : "mark_chat_as_unread",
            { p_chat_id: c.id },
          );
          if (r.error) throw r.error;
        } else {
          const values =
            action === "pin"
              ? { pinned_at: patch?.pinnedAt }
              : action === "favorite"
                ? { favorited_at: patch?.favoritedAt }
                : action === "archive"
                  ? { archived_at: patch?.archivedAt }
                  : { muted_until: patch?.mutedUntil };
          const r = await supabase
            .from("chat_members")
            .update(values)
            .eq("chat_id", c.id)
            .eq("user_id", user.id)
            .select("chat_id")
            .single();
          if (r.error) throw r.error;
        }
      }),
    );
    const failed = new Set(
      results.flatMap((r, i) => (r.status === "rejected" ? [chats[i]?.id] : [])),
    );
    failedIds.current = new Set([...failed].filter((id): id is string => !!id));
    if (failed.size) {
      cache.setQueryData<Chat[]>(key, (old) =>
        orderChats([
          ...(old ?? []).filter((c) => !failed.has(c.id)),
          ...before.filter((c) => failed.has(c.id)),
        ]),
      );
      setError(`${failed.size}/${chats.length}`);
    }
    await cache.invalidateQueries({ queryKey: key });
    locked.current = false;
    setBusy(false);
    return failed.size === 0;
  };
  return { run, busy, error, failedIds };
}
