import { AlertCircle, Check, CheckCheck, LoaderCircle } from "lucide-react";
import { Avatar } from "@/features/settings/components/shared";
import { useMessageText } from "../i18n";
import { messageStatus } from "../lib/messageStatus";
import type { ChatDetails, Message } from "../types";
import { formatMessageTime } from "../utils/formatMessageTime";
import { MessageContent } from "./MessageContent";
import { ReactionsDisplay } from "./ReactionsDisplay";
import { ReplyPreview } from "./ReplyPreview";
export function MessageBubble({
  message,
  chat,
  own,
  grouped,
  showAvatar,
  onMedia,
  onRetry,
}: {
  message: Message;
  chat: ChatDetails;
  own: boolean;
  grouped: boolean;
  showAvatar: boolean;
  onMedia: (message: Message) => void;
  onRetry: (message: Message) => void;
}) {
  const { language, say } = useMessageText();
  const status = messageStatus(message, chat.members);
  if (message.type === "system" && !message.deleted_for_everyone)
    return (
      <div data-message-id={message.id}>
        <MessageContent message={message} members={chat.members} onOpen={() => {}} />
      </div>
    );
  const statusLabel = {
    pending: say("Sending", "Enviando"),
    failed: say("Send failed. Retry", "El envío falló. Reintentar"),
    sent: say("Sent", "Enviado"),
    delivered: say("Delivered", "Entregado"),
    read: say("Read", "Leído"),
  }[status];
  return (
    <div
      data-message-id={message.id}
      className={`message-row ${own ? "own" : "incoming"} ${grouped ? "grouped" : ""} ${chat.type === "group" || chat.type === "community_chat" ? "group-chat" : ""}`}
    >
      {showAvatar ? (
        <Avatar profile={message.sender ?? { id: message.sender_id }} size="small" />
      ) : chat.type === "group" || chat.type === "community_chat" ? (
        <span className="message-avatar-space" />
      ) : null}
      <div className="message-stack">
        <div className={`message-bubble ${message.type === "sticker" ? "sticker-bubble" : ""}`}>
          {message.deleted_for_everyone ? (
            <p className="message-deleted">
              {say("This message was deleted", "Este mensaje fue eliminado")}
            </p>
          ) : (
            <>
              {showAvatar && (
                <strong className="message-author">
                  {message.sender?.display_name ?? say("Member", "Miembro")}
                </strong>
              )}
              {message.reply_to_message_id && <ReplyPreview message={message} />}
              <MessageContent
                message={message}
                members={chat.members}
                onOpen={() => onMedia(message)}
              />
              {message.type !== "sticker" && (
                <div className="message-meta">
                  <time dateTime={message.created_at}>
                    {formatMessageTime(message.created_at, language)}
                  </time>
                  {own &&
                    (status === "failed" ? (
                      <button
                        type="button"
                        aria-label={statusLabel}
                        className="message-retry"
                        onClick={() => onRetry(message)}
                      >
                        <AlertCircle size={14} />
                      </button>
                    ) : (
                      <span
                        role="img"
                        aria-label={statusLabel}
                        className={`message-status ${status}`}
                      >
                        {status === "pending" ? (
                          <LoaderCircle size={13} className="spin" />
                        ) : status === "sent" ? (
                          <Check size={13} />
                        ) : (
                          <CheckCheck size={13} />
                        )}
                      </span>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
        {!message.deleted_for_everyone && message.reactions.length > 0 && (
          <ReactionsDisplay reactions={message.reactions} />
        )}
      </div>
    </div>
  );
}
