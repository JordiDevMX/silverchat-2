import { AlertCircle, Check, CheckCheck, LoaderCircle, MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { Avatar } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { useMessageText } from "../i18n";
import { getAvailableActions } from "../lib/actionMatrix";
import { messageStatus } from "../lib/messageStatus";
import type { ChatDetails, Message } from "../types";
import { formatMessageTime } from "../utils/formatMessageTime";
import { useMessageActionUI } from "./MessageActionsProvider";
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
  const ui = useMessageActionUI();
  const { user } = useAuth();
  const suppressClickUntil = useRef(0);
  const press = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const cancelPress = useCallback(() => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  }, []);
  useEffect(() => () => cancelPress(), [cancelPress]);
  const available = getAvailableActions(message, user?.id ?? "", chat.readOnly).length > 0;
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
        {available && (
          <button
            type="button"
            className="message-overflow message-icon"
            disabled={ui.busy}
            aria-label={say("Message actions", "Acciones del mensaje")}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              ui.openMenu(message, { x: rect.left, y: rect.bottom });
            }}
          >
            <MoreHorizontal size={18} />
          </button>
        )}

        {/* biome-ignore lint/a11y/noStaticElementInteractions: Pointer gestures supplement the keyboard-accessible actions button. */}
        <div
          className={`message-bubble ${message.type === "sticker" ? "sticker-bubble" : ""}`}
          onContextMenu={(e) => {
            if (available) {
              e.preventDefault();
              cancelPress();
              ui.openMenu(message, { x: e.clientX, y: e.clientY });
            }
          }}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" || !available) return;
            cancelPress();
            const { clientX: x, clientY: y } = e;
            press.current = {
              x,
              y,
              timer: setTimeout(() => {
                press.current = null;
                suppressClickUntil.current = Date.now() + 800;
                ui.openMenu(message, { x, y });
              }, 500),
            };
          }}
          onPointerMove={(e) => {
            if (
              press.current &&
              Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 10
            )
              cancelPress();
          }}
          onClickCapture={(e) => {
            if (Date.now() < suppressClickUntil.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onPointerUp={cancelPress}
          onPointerCancel={cancelPress}
        >
          {message.deleted_for_everyone ? (
            <p className="message-deleted">
              {say("This message was deleted", "Este mensaje fue eliminado")}
            </p>
          ) : (
            <>
              {message.forwarded_from_message_id && (
                <small className="forwarded-label">{say("Forwarded", "Reenviado")}</small>
              )}
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
                  {message.edited_at && <span>{say("edited", "editado")}</span>}
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
          <ReactionsDisplay message={message} members={chat.members} />
        )}
      </div>
    </div>
  );
}
