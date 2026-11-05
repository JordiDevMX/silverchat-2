import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useRealtimeMessages } from "@/features/messages/hooks/useRealtimeMessages";
import { useMessageText } from "@/features/messages/i18n";
import type { ChatDetails } from "@/features/messages/types";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshChatSettings } from "../lib/cache";
import type { ChatAction } from "../lib/chatActions";
import { useChatUIStore } from "../stores/uiStore";

export function useChatSettingsLayer(
  chat: ChatDetails,
  onSearch?: () => void,
  context: "group" | "community" = "group",
) {
  const ui = useChatUIStore();
  const { user } = useAuth();
  const { say } = useMessageText();
  const cache = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  useRealtimeMessages(chat.id, context !== "community");
  useEffect(
    () => () => {
      if (useChatUIStore.getState().chatId === chat.id) useChatUIStore.getState().close();
    },
    [chat.id],
  );
  const modal = ui.chatId === chat.id ? ui.modal : null;
  const update = async (patch: { muted_until?: string | null; pinned_at?: string | null }) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await supabase
        .from("chat_members")
        .update(patch)
        .eq("chat_id", chat.id)
        .eq("user_id", user?.id ?? "")
        .select("chat_id")
        .single();
      if (result.error) throw result.error;
      ui.close();
      await refreshChatSettings(cache, user?.id ?? "", chat.id);
    } catch {
      ui.notify(
        say(
          "Unable to update chat. Try again.",
          "No se pudo actualizar el chat. Inténtalo de nuevo.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  const choose = async (action: ChatAction) => {
    ui.close();
    if (action === "view_profile" || action === "block" || action === "report") {
      if (chat.otherUserId)
        ui.open(chat.id, {
          kind: action === "view_profile" ? "contact" : action,
          userId: chat.otherUserId,
          name: chat.other?.display_name ?? chat.name,
        });
      return;
    }
    if (action === "view_community_info") {
      await router.navigate({
        href: `/communities/${chat.communityId ?? chat.id}/info`,
      });
      return;
    }
    if (action === "view_group_info" || action === "view_members") {
      await router.navigate({
        href: `/chats/${chat.id}/${action === "view_members" ? "members" : "info"}`,
      });
      return;
    }
    if (action === "search_in_chat") {
      onSearch?.();
      return;
    }
    if (action === "mute") {
      ui.open(chat.id, { kind: "mute" });
      return;
    }
    if (action === "unmute") {
      await update({ muted_until: null });
      return;
    }
    if (action === "pin" || action === "unpin") {
      await update({ pinned_at: action === "pin" ? new Date().toISOString() : null });
      return;
    }
    if (action === "mark_unread") {
      try {
        const result = await supabase.rpc("mark_chat_as_unread", { p_chat_id: chat.id });
        if (result.error) throw result.error;
        await router.navigate({
          href: chat.type === "community_chat" ? `/communities/${chat.communityId}` : "/chats",
        });
        await refreshChatSettings(cache, user?.id ?? "", chat.id);
      } catch {
        ui.notify(say("Unable to mark as unread.", "No se pudo marcar como no leído."));
      }
      return;
    }
    ui.open(chat.id, {
      kind: action === "add_members" ? "add" : action === "clear_chat" ? "clear" : "leave",
    });
  };

  const afterBlock = () => {
    ui.close();
    void refreshChatSettings(cache, user?.id ?? "", chat.id);
  };
  return { ui, modal, busy, update, choose, afterBlock };
}
