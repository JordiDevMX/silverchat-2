import { ChevronLeft, MessageCircle, MoreVertical } from "lucide-react";
import { ConversationHeaderSurface } from "@/components/ui/conversation-surface";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { useMessageText } from "@/features/messages/i18n";
import type { ChatDetails } from "@/features/messages/types";
import { NavLink } from "@/features/settings/components/shared";
export function CommunityChatHeader({ chat }: { chat: ChatDetails }) {
  const { say } = useMessageText();
  const ui = useChatUIStore();
  return (
    <ConversationHeaderSurface className="community-conversation-header">
      <span className="lg:hidden">
        <NavLink className="message-icon" href={`/communities/${chat.communityId}`}>
          <ChevronLeft aria-label={say("Back to community", "Volver a la comunidad")} />
        </NavLink>
      </span>
      <NavLink
        className="conversation-identity min-w-0 flex-1"
        href={`/communities/${chat.communityId}/info`}
      >
        <span className="community-chat-icon">
          <MessageCircle size={20} aria-hidden="true" />
        </span>
        <span>
          <strong>{chat.name}</strong>
          <small>{chat.communityName}</small>
        </span>
      </NavLink>
      <button
        type="button"
        className="message-icon"
        aria-label={say("Chat options", "Opciones del chat")}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          ui.open(chat.id, { kind: "menu", x: r.right - 240, y: r.bottom + 4 });
        }}
      >
        <MoreVertical size={20} />
      </button>
    </ConversationHeaderSurface>
  );
}
