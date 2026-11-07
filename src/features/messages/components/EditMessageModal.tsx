import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/features/auth/components";
import { useEditMessageDialog } from "../hooks/useEditMessageDialog";
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
  const inputId = useId();
  const { say } = useMessageText();
  const { text, setText, error, save } = useEditMessageDialog(
    message.content ?? "",
    onSave,
    onClose,
  );
  return (
    <Modal
      className="messaging-dialog"
      title={say("Edit message", "Editar mensaje")}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <label className="field" htmlFor={inputId}>
        {say("Message", "Mensaje")}
        <Textarea
          id={inputId}
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
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={busy}
          onClick={onClose}
        >
          {say("Cancel", "Cancelar")}
        </Button>
        <Button
          type="button"
          className="rounded-xl"
          disabled={
            busy || (message.type === "text" && !text.trim()) || text === (message.content ?? "")
          }
          onClick={save}
        >
          {say("Save", "Guardar")}
        </Button>
      </div>
    </Modal>
  );
}
