import { Archive, Check, Trash2, VolumeX, X } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { useChatText } from "../i18n";
import type { ChatAction } from "../types";
export function MultiSelectToolbarSurface({
  t,
  count,
  all,
  busy,
  onClose,
  onAll,
  onAction,
  canDelete = true,
}: {
  t: (value: string, spanish?: string) => string;
  count: number;
  all: boolean;
  busy: boolean;
  onClose: () => void;
  onAll: () => void;
  onAction: (action: ChatAction) => void;
  canDelete?: boolean;
}) {
  return (
    <>
      <header className="chat-selection-header">
        <Button variant="ghost" type="button" aria-label={t("Exit selection")} onClick={onClose}>
          <X />
        </Button>
        <strong aria-live="polite">
          {count} {t("selected")}
        </strong>
        <Button variant="ghost" type="button" onClick={onAll}>
          {t(all ? "Deselect all" : "Select all")}
        </Button>
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
          <Button
            variant="ghost"
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
          </Button>
        ))}
      </div>
    </>
  );
}

export function MultiSelectToolbar(
  props: Omit<ComponentProps<typeof MultiSelectToolbarSurface>, "t">,
) {
  const t = useChatText();
  return <MultiSelectToolbarSurface {...props} t={t} />;
}
