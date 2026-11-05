import { useMessageText } from "@/features/messages/i18n";
import type { ChatDetails } from "@/features/messages/types";
import { BlockUserModal } from "@/features/settings/components/BlockUserModal";
import { NavLink, QueryState } from "@/features/settings/components/shared";
import { useChatSettingsLayer } from "../hooks/useChatSettingsLayer";
import type { ChatAction } from "../lib/chatActions";
import { AddMembersModal } from "./AddMembersModal";
import { ChatOptionsMenu } from "./ChatOptionsMenu";
import { ClearChatModal } from "./ClearChatModal";
import { ContactProfileModal } from "./ContactProfileModal";
import { LeaveGroupModal } from "./LeaveGroupModal";
import { MuteSubmenu } from "./MuteSubmenu";
import { ReportModal } from "./ReportModal";
import "@/styles/chat-settings.css";
export function ChatSettingsLoading({
  query,
}: {
  query?: { isPending: boolean; error: unknown; refetch: () => Promise<unknown> };
}) {
  const { say } = useMessageText();
  return (
    <main id="main" className="chat-settings-screen chat-settings-panel settings-panel">
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
  context = "group",
}: {
  chat: ChatDetails;
  onSearch?: () => void;
  context?: "group" | "community";
}) {
  const { ui, modal, busy, update, choose, afterBlock } = useChatSettingsLayer(
    chat,
    onSearch,
    context,
  );
  if (!modal) return null;
  switch (modal.kind) {
    case "menu":
      return (
        <ChatOptionsMenu
          contextType={chat.type === "community_chat" ? "community_chat" : "chat"}
          chat={chat}
          point={modal}
          onChoose={(action: ChatAction) => void choose(action)}
          onClose={ui.close}
        />
      );
    case "contact":
      return <ContactProfileModal userId={modal.userId} chat={chat} />;
    case "block":
      return (
        <BlockUserModal
          target={{ id: modal.userId, display_name: modal.name ?? "" }}
          onClose={afterBlock}
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
      return chat.own?.role === "admin" ? <AddMembersModal chat={chat} context={context} /> : null;
    case "clear":
      return <ClearChatModal chatId={chat.id} />;
    case "leave":
      return <LeaveGroupModal chat={chat} />;
  }
}
