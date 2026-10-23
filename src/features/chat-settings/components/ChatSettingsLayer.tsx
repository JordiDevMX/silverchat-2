import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { useChat } from "@/features/messages/hooks/useChat";
import { useRealtimeMessages } from "@/features/messages/hooks/useRealtimeMessages";
import { useMessageText } from "@/features/messages/i18n";
import type { ChatDetails } from "@/features/messages/types";
import { BlockUserModal } from "@/features/settings/components/BlockUserModal";
import { NavLink, QueryState } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshChatSettings } from "../lib/cache";
import type { ChatAction } from "../lib/chatActions";
import { useChatUIStore } from "../stores/uiStore";
import { AddMembersModal } from "./AddMembersModal";
import { ChatOptionsMenu } from "./ChatOptionsMenu";
import { ClearChatModal } from "./ClearChatModal";
import { ContactProfileModal } from "./ContactProfileModal";
import { LeaveGroupModal } from "./LeaveGroupModal";
import { MuteSubmenu } from "./MuteSubmenu";
import { ReportModal } from "./ReportModal";
import "@/styles/chat-settings.css";
export function ChatSettingsLoading({ query }: { query?: ReturnType<typeof useChat> }) {
  const { say } = useMessageText();
  return (
    <main id="main" className="chat-settings-screen">
      <NavLink href="/chats">← {say("Back to chats", "Volver a chats")}</NavLink>
      {query && (
        <QueryState
          loading={query.isPending}
          error={query.error}
          retry={() => void query.refetch()}
        />
      )}
      <p>{!query?.isPending && say("Chat unavailable", "Chat no disponible")}</p>
    </main>
  );
}
export function ChatSettingsLayer({
  chat,
  onSearch,
}: {
  chat: ChatDetails;
  onSearch?: () => void;
}) {
  const ui = useChatUIStore();
  const { user } = useAuth();
  const { say } = useMessageText();
  const cache = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  useRealtimeMessages(chat.id);
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
        await router.navigate({ href: "/chats" });
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
  if (!modal) return null;
  switch (modal.kind) {
    case "menu":
      return (
        <ChatOptionsMenu
          chat={chat}
          point={modal}
          onChoose={(action) => void choose(action)}
          onClose={ui.close}
        />
      );
    case "contact":
      return <ContactProfileModal userId={modal.userId} chat={chat} />;
    case "block":
      return (
        <BlockUserModal
          target={{ id: modal.userId, display_name: modal.name ?? "" }}
          onClose={() => {
            ui.close();
            void refreshChatSettings(cache, user?.id ?? "", chat.id);
          }}
        />
      );
    case "report":
      return <ReportModal userId={modal.userId} name={modal.name ?? ""} />;
    case "mute":
      return (
        <MuteSubmenu
          muted={!!chat.own?.muted_until && Date.parse(chat.own.muted_until) > Date.now()}
          busy={busy}
          onChoose={(until) => void update({ muted_until: until })}
          onClose={ui.close}
        />
      );
    case "add":
      return chat.own?.role === "admin" ? <AddMembersModal chat={chat} /> : null;
    case "clear":
      return <ClearChatModal chatId={chat.id} />;
    case "leave":
      return <LeaveGroupModal chat={chat} />;
  }
}
