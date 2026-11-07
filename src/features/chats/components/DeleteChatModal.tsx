import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/ui/settings-surfaces";
import { useChatText } from "../i18n";
import type { Chat } from "../types";
export function DeleteChatModalSurface({
  t,
  chats,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  t: (value: string, spanish?: string) => string;
  chats: Chat[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <SettingsDialog
      title={`${t("Delete chat")} (${chats.length})`}
      onClose={onClose}
      canClose={!busy}
    >
      {(close) => (
        <>
          <ul className="chat-delete-summary">
            {chats.map((c) => (
              <li key={c.id}>
                <strong>{t(c.displayName)}</strong>
                <p>
                  {c.type === "direct"
                    ? t(
                        "This chat will be removed from your list. It will reappear if the other person messages you.",
                        "Este chat se quitará de tu lista. Volverá si la otra persona te escribe.",
                      )
                    : c.type === "self"
                      ? t(
                          "All your notes and messages to yourself will be permanently deleted.",
                          "Todas tus notas y mensajes a ti mismo se eliminarán permanentemente.",
                        )
                      : t("You will leave this group.", "Saldrás de este grupo.")}
                  {c.isLastAdmin &&
                    " " +
                      t(
                        "The oldest remaining member will be promoted to admin.",
                        "El miembro más antiguo que permanezca será administrador.",
                      )}
                </p>
              </li>
            ))}
          </ul>
          {error && (
            <p role="alert">
              {t(
                "Some chats could not be deleted. Retry the remaining items.",
                "No se pudieron eliminar algunos chats. Reintenta los restantes.",
              )}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="outline" disabled={busy} onClick={close}>
              {t("Cancel")}
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={onConfirm}>
              {t(busy ? "Working…" : "Delete")}
            </Button>
          </div>
        </>
      )}
    </SettingsDialog>
  );
}

export function DeleteChatModal(props: Omit<ComponentProps<typeof DeleteChatModalSurface>, "t">) {
  const t = useChatText();
  return <DeleteChatModalSurface {...props} t={t} />;
}
