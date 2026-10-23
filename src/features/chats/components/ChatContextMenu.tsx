import { Archive, Ban, Check, MailOpen, Pin, Star, Trash2, VolumeX } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useChatText } from "../i18n";
import type { Chat, ChatAction } from "../types";
import { isMuted } from "../utils/computeChatDisplay";
export function ChatContextMenu({
  chat,
  x,
  y,
  onAction,
  onBlock,
  onClose,
}: {
  chat: Chat;
  x: number;
  y: number;
  onAction: (action: ChatAction, until?: string | null) => void;
  onBlock: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mute, setMute] = useState(false);
  const t = useChatText();
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - menu.offsetHeight - 8))}px`;
    const previous = document.activeElement as HTMLElement | null;
    menu.querySelector("button")?.focus();
    const dismiss = (e: PointerEvent) => {
      if (!menu.contains(e.target as Node)) onClose();
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismissOnEscape);
      previous?.focus({ preventScroll: true });
    };
  }, [x, y, onClose]);
  useLayoutEffect(() => {
    if (mute) ref.current?.querySelector("button")?.focus();
  }, [mute]);
  const action = (key: ChatAction, until?: string | null) => {
    onAction(key, until);
    onClose();
  };
  const entries = [
    [Pin, chat.pinnedAt ? "Unpin" : "Pin", () => action("pin")],
    [Star, chat.favoritedAt ? "Unfavorite" : "Favorite", () => action("favorite")],
    [
      VolumeX,
      isMuted(chat) ? "Unmute" : "Mute",
      () => (isMuted(chat) ? action("mute", null) : setMute(true)),
    ],
    [Archive, chat.archivedAt ? "Unarchive" : "Archive", () => action("archive")],
    [Check, "Mark as read", () => action("read")],
    [MailOpen, "Mark as unread", () => action("unread")],
    ...(chat.otherUserId && !chat.isBlocked
      ? [
          [
            Ban,
            "Block",
            () => {
              onBlock();
              onClose();
            },
          ] as const,
        ]
      : []),
    [Trash2, "Delete chat", () => action("delete")],
  ] as const;
  return createPortal(
    <div
      ref={ref}
      className="chat-context-menu"
      role="menu"
      aria-label={t(mute ? "Mute for…" : "Chat actions")}
      onKeyDown={(e) => {
        const buttons = Array.from(ref.current?.querySelectorAll("button") ?? []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === "Escape" || e.key === "Tab") {
          e.preventDefault();
          onClose();
        } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          buttons[
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? buttons.length - 1
                : (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length
          ]?.focus();
        }
      }}
    >
      <p>{mute ? t("Mute for…") : t(chat.displayName)}</p>
      {mute
        ? (
            [
              ["1 hour", 1],
              ["8 hours", 8],
              ["1 day", 24],
              ["1 week", 168],
              ["Always", 0],
            ] as const
          ).map(([label, hours]) => (
            <button
              role="menuitem"
              key={label}
              type="button"
              onClick={() =>
                action(
                  "mute",
                  hours
                    ? new Date(Date.now() + hours * 3600000).toISOString()
                    : "9999-12-31T00:00:00Z",
                )
              }
            >
              {t(label)}
            </button>
          ))
        : entries.map(([Icon, label, run]) => (
            <button
              role="menuitem"
              type="button"
              className={label === "Block" || label === "Delete chat" ? "destructive-text" : ""}
              key={label}
              onClick={run}
            >
              <Icon size={17} />
              {t(label)}
            </button>
          ))}
    </div>,
    document.body,
  );
}
