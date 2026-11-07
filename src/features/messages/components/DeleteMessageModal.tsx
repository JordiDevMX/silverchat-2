import { Button } from "@/components/ui/button";
import { Modal } from "@/features/auth/components";
import { useDeleteMessageDialog } from "../hooks/useDeleteMessageDialog";
import { useMessageText } from "../i18n";
export function DeleteMessageModal({
  everyone,
  onDelete,
  onClose,
  busy,
}: {
  everyone: boolean;
  onDelete: (everyone: boolean) => Promise<void>;
  onClose: () => void;
  busy: boolean;
}) {
  const { say } = useMessageText();
  const { error, remove } = useDeleteMessageDialog(onDelete, onClose);
  return (
    <Modal
      className="messaging-dialog"
      title={say("Delete message?", "¿Eliminar mensaje?")}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p>
        {say(
          "Deleting for yourself only removes the message from your view.",
          "Eliminar para ti solo lo quita de tu vista.",
        )}
      </p>
      {everyone && (
        <p>
          {say(
            "Deleting for everyone leaves a deleted-message placeholder. This cannot be undone.",
            "Eliminar para todos deja un aviso de mensaje eliminado. No se puede deshacer.",
          )}
        </p>
      )}
      {error && (
        <p role="alert">
          {say(
            "Unable to delete. The one-hour limit may have passed. Try again.",
            "No se pudo eliminar. El límite de una hora pudo haber terminado. Inténtalo de nuevo.",
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
          variant="outline"
          className="rounded-xl"
          disabled={busy}
          onClick={() => void remove(false)}
        >
          {say("Delete for me", "Eliminar para mí")}
        </Button>
        {everyone && (
          <Button
            type="button"
            variant="destructive"
            className="rounded-xl"
            disabled={busy}
            onClick={() => void remove(true)}
          >
            {say("Delete for everyone", "Eliminar para todos")}
          </Button>
        )}
      </div>
    </Modal>
  );
}
