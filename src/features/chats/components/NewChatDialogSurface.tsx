import { Bookmark, MessageSquarePlus, Radio, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/ui/settings-surfaces";
export function NewChatDialogSurface({
  t,
  busy,
  feedback,
  go,
  createSelf,
  onClose,
}: {
  t: (text: string) => string;
  busy: boolean;
  feedback?: ReactNode;
  go: (href: string) => void;
  createSelf: () => void;
  onClose: () => void;
}) {
  return (
    <SettingsDialog
      className="new-chat-dialog"
      title={t("New chat")}
      onClose={onClose}
      canClose={!busy}
    >
      {(close) => (
        <div className="new-chat-menu">
          {(
            [
              [MessageSquarePlus, "New chat", "/chats/new"],
              [Users, "New group", "/chats/new-group"],
              [Radio, "New channel", "/channels/new"],
            ] as const
          ).map(([Icon, label, href]) => (
            <Button
              variant="outline"
              disabled={busy}
              type="button"
              key={href}
              onClick={() => go(href)}
            >
              <Icon size={20} />
              {t(label)}
            </Button>
          ))}
          <Button type="button" variant="outline" disabled={busy} onClick={() => void createSelf()}>
            <Bookmark size={20} />
            {t("Message yourself")}
          </Button>
          {feedback}
          <Button variant="outline" type="button" disabled={busy} onClick={close}>
            {t("Cancel")}
          </Button>
        </div>
      )}
    </SettingsDialog>
  );
}
