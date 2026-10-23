import {
  AlertCircle,
  Archive,
  Check,
  CheckCheck,
  FileText,
  Image,
  LoaderCircle,
  MapPin,
  Mic,
  Pin,
  Star,
  Sticker,
  User,
  Video,
  VolumeX,
} from "lucide-react";
import { type MouseEvent, useEffect, useRef } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { Avatar } from "@/features/settings/components/shared";
import { useChatText } from "../i18n";
import type { Chat, ChatAction, Draft } from "../types";
import { badgeText, computeChatDisplay, isMuted } from "../utils/computeChatDisplay";
import { formatChatTimestamp } from "../utils/formatChatTimestamp";
import { SwipeActions } from "./SwipeActions";

const mediaIcons = {
  image: Image,
  video: Video,
  audio: Mic,
  file: FileText,
  sticker: Sticker,
  location: MapPin,
  contact: User,
};
export function ChatListItem({
  chat,
  draft,
  selecting,
  selected,
  busy,
  onOpen,
  onSelect,
  onMenu,
  onAction,
}: {
  chat: Chat;
  draft?: Draft;
  selecting: boolean;
  selected: boolean;
  busy: boolean;
  onOpen: () => void;
  onSelect: (shift: boolean) => void;
  onMenu: (x: number, y: number) => void;
  onAction: (action: ChatAction) => void;
}) {
  const t = useChatText();
  const { language } = useI18n();
  const hold = useRef<ReturnType<typeof setTimeout>>(undefined);
  const origin = useRef({ x: 0, y: 0 });
  const consumed = useRef(false);
  useEffect(() => () => clearTimeout(hold.current), []);
  const display = computeChatDisplay(chat, draft),
    muted = isMuted(chat);
  const Media =
    chat.lastMessageType && chat.lastMessageType in mediaIcons
      ? mediaIcons[chat.lastMessageType as keyof typeof mediaIcons]
      : null;
  const seen = chat.lastSeenAt ? Date.parse(chat.lastSeenAt) : 0;
  const online = seen > 0 && Date.now() - seen < 300000 && seen <= Date.now() + 60000;
  const activate = (e: MouseEvent) => {
    if (consumed.current) {
      consumed.current = false;
      return;
    }
    if (selecting) onSelect(e.shiftKey);
    else onOpen();
  };
  return (
    <li
      className={`chat-list-item ${selected ? "is-selected" : ""} ${chat.isBlocked ? "is-blocked" : ""}`}
      data-chat-id={chat.id}
    >
      <SwipeActions disabled={selecting || busy} onAction={onAction}>
        <div className="chat-row">
          <button
            type="button"
            className="chat-row-main"
            aria-pressed={selecting ? selected : undefined}
            aria-label={`${t(chat.displayName)}${display.state === "failed" ? `. ${t("Tap to retry")}` : ""}`}
            onClick={activate}
            onContextMenu={(e) => {
              e.preventDefault();
              if (!selecting && !consumed.current) onMenu(e.clientX, e.clientY);
            }}
            onKeyDown={(e) => {
              if (!selecting && (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10"))) {
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                onMenu(r.left + 80, r.top + 20);
              }
            }}
            onPointerDown={(e) => {
              consumed.current = false;
              if (selecting || e.button !== 0) return;
              origin.current = { x: e.clientX, y: e.clientY };
              clearTimeout(hold.current);
              hold.current = setTimeout(() => {
                consumed.current = true;
                onMenu(origin.current.x, origin.current.y);
              }, 500);
            }}
            onPointerMove={(e) => {
              if (
                Math.abs(e.clientX - origin.current.x) > 8 ||
                Math.abs(e.clientY - origin.current.y) > 8
              )
                clearTimeout(hold.current);
            }}
            onPointerUp={() => clearTimeout(hold.current)}
            onPointerCancel={() => clearTimeout(hold.current)}
            onPointerLeave={() => clearTimeout(hold.current)}
          >
            {selecting ? (
              <span className="chat-checkbox" aria-hidden="true">
                {selected && <Check size={20} />}
              </span>
            ) : (
              <span className="chat-avatar">
                <Avatar
                  profile={{
                    id: chat.otherUserId ?? chat.id,
                    display_name: chat.displayName,
                    avatar_url: chat.avatarUrl,
                    initials: chat.avatarInitials,
                  }}
                />
                {online && <span className="presence-dot" title={t("Online")} />}
              </span>
            )}
            <span className="chat-row-copy">
              <span className="chat-name">
                <strong>{t(chat.displayName)}</strong>
                {muted && <VolumeX size={14} aria-label={t("Muted")} />}
                {chat.pinnedAt && <Pin size={14} aria-label={t("Pin")} />}
                {chat.favoritedAt && <Star size={14} aria-label={t("Favorite")} />}
              </span>
              <span className={`chat-preview preview-${display.state}`}>
                {display.state === "failed" ? (
                  <AlertCircle size={16} />
                ) : display.state === "pending" ? (
                  <LoaderCircle className="chat-spin" size={16} />
                ) : display.state === "message" && Media ? (
                  <Media size={16} />
                ) : null}
                {display.state === "draft" && <span className="draft-pill">{t("Draft")}</span>}
                <span className="preview-text">
                  {display.prefix && display.state !== "draft" ? `${t(display.prefix)}: ` : ""}
                  {display.state === "draft" ? `${t("Draft")}: ` : ""}
                  {t(display.text)}
                </span>
                {display.status === "sent" ? (
                  <Check size={17} aria-label={t("sent")} />
                ) : display.status ? (
                  <CheckCheck
                    size={17}
                    className={display.status === "read" ? "receipt-read" : ""}
                    aria-label={t(display.status)}
                  />
                ) : null}
              </span>
            </span>
            <span className="chat-row-meta">
              <span className="chat-time">
                {chat.archivedAt && <Archive size={12} />}
                <time dateTime={chat.lastMessageAt ?? undefined}>
                  {formatChatTimestamp(chat.lastMessageAt, language)}
                </time>
              </span>
              {chat.manuallyUnread ? (
                <span role="img" className="unread-dot" aria-label={t("Unread")} />
              ) : !muted && chat.unreadCount > 0 ? (
                <span
                  role="img"
                  className="chat-badge"
                  aria-label={`${chat.unreadCount} ${t("Unread")}`}
                >
                  {badgeText(chat.unreadCount)}
                </span>
              ) : null}
            </span>
          </button>
          {!selecting && (
            <div className="chat-hover-actions">
              {(
                [
                  [Pin, chat.pinnedAt ? "Unpin" : "Pin", "pin"],
                  [Archive, chat.archivedAt ? "Unarchive" : "Archive", "archive"],
                  [VolumeX, muted ? "Unmute" : "Mute", "mute"],
                ] as const
              ).map(([Icon, label, action]) => (
                <button
                  disabled={busy}
                  type="button"
                  key={action}
                  aria-label={t(label)}
                  title={t(label)}
                  onClick={() => onAction(action)}
                >
                  <Icon size={17} />
                </button>
              ))}
            </div>
          )}
        </div>
      </SwipeActions>
    </li>
  );
}
