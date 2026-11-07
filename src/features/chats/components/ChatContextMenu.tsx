import { Archive, Ban, Check, MailOpen, Pin, Star, Trash2, VolumeX } from "lucide-react";
import { useMemo, useState } from "react";
import { ChatMenuSurface } from "@/components/ui/chat-menu-surface";
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
  onSelect,
}: {
  chat: Chat;
  x: number;
  y: number;
  onAction: (action: ChatAction, until?: string | null) => void;
  onBlock: () => void;
  onClose: () => void;
  onSelect?: () => void;
}) {
  const [mute, setMute] = useState(false);
  const t = useChatText();
  const point = useMemo(() => ({ x, y }), [x, y]);
  const action = (key: ChatAction, until?: string | null) => {
    onAction(key, until);
    onClose();
  };
  const entries = [
    ...(onSelect
      ? [
          [
            Check,
            "Select",
            () => {
              onSelect();
              onClose();
            },
          ] as const,
        ]
      : []),
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
    ...(chat.type === "community_chat"
      ? []
      : [[Trash2, "Delete chat", () => action("delete")] as const]),
  ] as const;
  return (
    <ChatMenuSurface
      key={mute ? "mute" : "actions"}
      label={t(mute ? "Mute for…" : "Chat actions")}
      heading={t(mute ? "Mute for…" : chat.displayName)}
      point={point}
      onClose={onClose}
      items={
        mute
          ? (
              [
                ["1 hour", 1],
                ["8 hours", 8],
                ["1 day", 24],
                ["1 week", 168],
                ["Always", 0],
              ] as const
            ).map(([label, hours]) => ({
              key: label,
              label: t(label),
              onSelect: () =>
                action(
                  "mute",
                  hours
                    ? new Date(Date.now() + hours * 3600000).toISOString()
                    : "9999-12-31T00:00:00Z",
                ),
            }))
          : entries.map(([Icon, label, run]) => ({
              key: label,
              label: t(label),
              icon: <Icon size={17} />,
              destructive: label === "Block" || label === "Delete chat",
              onSelect: run,
            }))
      }
    />
  );
}
