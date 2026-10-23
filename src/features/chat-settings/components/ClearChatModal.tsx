import { Modal } from "@/features/auth/components";
import { useMessageText } from "@/features/messages/i18n";
import { useClearChat } from "../hooks/useClearChat";
import { useChatUIStore } from "../stores/uiStore";
export function ClearChatModal({ chatId }: { chatId: string }) {
  const { say } = useMessageText();
  const ui = useChatUIStore();
  const mutation = useClearChat(chatId);
  return (
    <Modal
      title={say("Clear this chat?", "¿Vaciar este chat?")}
      onClose={mutation.isPending ? undefined : ui.close}
    >
      <p>
        {say(
          "All messages will be removed from your view. Other participants will still see them.",
          "Todos los mensajes se quitarán de tu vista. Los demás participantes seguirán viéndolos.",
        )}
      </p>
      {mutation.isError && (
        <p role="alert">
          {say(
            "Unable to clear chat. Try again.",
            "No se pudo vaciar el chat. Inténtalo de nuevo.",
          )}
        </p>
      )}
      <div className="modal-actions">
        <button
          type="button"
          className="button secondary"
          disabled={mutation.isPending}
          onClick={ui.close}
        >
          {say("Cancel", "Cancelar")}
        </button>
        <button
          type="button"
          className="button danger"
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate(undefined, {
              onSuccess: () => {
                ui.notify(say("Chat cleared", "Chat vaciado"));
                ui.close();
              },
            })
          }
        >
          {say("Clear chat", "Vaciar chat")}
        </button>
      </div>
    </Modal>
  );
}
