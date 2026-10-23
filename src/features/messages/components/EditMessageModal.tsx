import { useState } from "react";
import { Modal } from "@/features/auth/components";
import { useMessageText } from "../i18n";
import type { Message } from "../types";
export function EditMessageModal({
  message,
  onSave,
  onClose,
  busy,
}: {
  message: Message;
  onSave: (text: string) => Promise<void>;
  onClose: () => void;
  busy: boolean;
}) {
  const { say } = useMessageText();
  const [text, setText] = useState(message.content ?? "");
  const [error, setError] = useState(false);
  return (
    <Modal
      title={say("Edit message", "Editar mensaje")}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <label className="field">
        {say("Message", "Mensaje")}
        <textarea
          value={text}
          maxLength={message.type === "text" ? undefined : 500}
          onChange={(e) => setText(e.target.value)}
          rows={4}
        />
      </label>
      {message.type !== "text" && <small>{text.length}/500</small>}
      {error && (
        <p role="alert">
          {say(
            "Unable to save. The 15-minute editing window may have closed.",
            "No se pudo guardar. El plazo de 15 minutos pudo haber terminado.",
          )}
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
          {say("Cancel", "Cancelar")}
        </button>
        <button
          type="button"
          className="button primary"
          disabled={
            busy || (message.type === "text" && !text.trim()) || text === (message.content ?? "")
          }
          onClick={async () => {
            setError(false);
            try {
              await onSave(text);
              onClose();
            } catch {
              setError(true);
            }
          }}
        >
          {say("Save", "Guardar")}
        </button>
      </div>
    </Modal>
  );
}
