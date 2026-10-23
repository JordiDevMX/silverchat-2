import { Modal } from "@/features/auth/components";
import { useChatText } from "../i18n";
import type { Chat } from "../types";
export function DeleteChatModal({
  chats,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  chats: Chat[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useChatText();
  return (
    <Modal title={`${t("Delete chat")} (${chats.length})`} onClose={busy ? undefined : onClose}>
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
        <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
          {t("Cancel")}
        </button>
        <button type="button" className="button danger" disabled={busy} onClick={onConfirm}>
          {t(busy ? "Working…" : "Delete")}
        </button>
      </div>
    </Modal>
  );
}
