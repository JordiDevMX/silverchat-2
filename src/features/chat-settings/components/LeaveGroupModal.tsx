import { Modal } from "@/features/auth/components";
import { useMessageText } from "@/features/messages/i18n";
import type { ChatDetails } from "@/features/messages/types";
import { useLeaveGroup } from "../hooks/useLeaveGroup";
import { useChatUIStore } from "../stores/uiStore";
export function LeaveGroupModal({ chat }: { chat: ChatDetails }) {
  const { say } = useMessageText();
  const ui = useChatUIStore();
  const mutation = useLeaveGroup(chat.id);
  const lastAdmin =
    chat.own?.role === "admin" && chat.members.filter((m) => m.role === "admin").length === 1;
  return (
    <Modal
      title={`${say("Leave", "Salir de")} ${chat.name}?`}
      onClose={mutation.isPending ? undefined : ui.close}
    >
      <p>
        {chat.members.length === 1
          ? say("This group will be deleted.", "Este grupo se eliminará.")
          : lastAdmin
            ? say(
                "You’re the last admin. The oldest member will be promoted automatically.",
                "Eres el último administrador. El miembro más antiguo será ascendido automáticamente.",
              )
            : say(
                "You won’t receive messages from this group anymore.",
                "Ya no recibirás mensajes de este grupo.",
              )}
      </p>
      {mutation.isError && (
        <p role="alert">
          {say("Unable to leave. Try again.", "No se pudo salir. Inténtalo de nuevo.")}
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
          onClick={() => mutation.mutate()}
        >
          {say("Leave group", "Salir del grupo")}
        </button>
      </div>
    </Modal>
  );
}
