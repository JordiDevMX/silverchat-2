import { Archive, Check, Trash2, VolumeX, X } from "lucide-react";
import { useChatText } from "../i18n";
import type { ChatAction } from "../types";
export function MultiSelectToolbar({
  count,
  all,
  busy,
  onClose,
  onAll,
  onAction,
  canDelete = true,
}: {
  count: number;
  all: boolean;
  busy: boolean;
  onClose: () => void;
  onAll: () => void;
  onAction: (action: ChatAction) => void;
  canDelete?: boolean;
}) {
  const t = useChatText();
  return (
    <>
      <header className="chat-selection-header">
        <button type="button" aria-label={t("Exit selection")} onClick={onClose}>
          <X />
        </button>
        <strong aria-live="polite">
          {count} {t("selected")}
        </strong>
        <button type="button" onClick={onAll}>
          {t(all ? "Deselect all" : "Select all")}
        </button>
      </header>
      <div className="chat-selection-bar" role="toolbar" aria-label={t("Chat actions")}>
        {(
          [
            [VolumeX, "Mute", "mute"],
            [Archive, "Archive", "archive"],
            [Check, "Mark as read", "read"],
            [Trash2, "Delete", "delete"],
          ] as const
        ).map(([Icon, label, action]) => (
          <button
            type="button"
            key={action}
            disabled={!count || busy || (action === "delete" && !canDelete)}
            title={
              action === "delete" && !canDelete
                ? t(
                    "Leave community chats from Community info",
                    "Sal de los chats desde la información de la comunidad",
                  )
                : undefined
            }
            className={action === "delete" ? "destructive-text" : ""}
            onClick={() => onAction(action)}
          >
            <Icon size={21} />
            <span>{t(label)}</span>
          </button>
        ))}
      </div>
    </>
  );
}
