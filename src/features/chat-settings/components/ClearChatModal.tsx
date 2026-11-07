import { Button } from "@/components/ui/button";
import { ChatSettingsDialog } from "@/components/ui/chat-settings-surfaces";
import { useClearChatDialog } from "../hooks/useChatDialogActions";
export function ClearChatModal({ chatId }: { chatId: string }) {
  const { say, ui, mutation, submit } = useClearChatDialog(chatId);
  return (
    <ChatSettingsDialog
      title={say("Clear this chat?", "¿Vaciar este chat?")}
      onClose={ui.close}
      canClose={!mutation.isPending}
    >
      {(dismiss) => (
        <>
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
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={dismiss}>
              {say("Cancel", "Cancelar")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={mutation.isPending}
              onClick={submit}
            >
              {say("Clear chat", "Vaciar chat")}
            </Button>
          </div>
        </>
      )}
    </ChatSettingsDialog>
  );
}
