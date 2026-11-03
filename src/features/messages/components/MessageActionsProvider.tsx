import { createContext, type ReactNode, useContext } from "react";
import { type UI, useMessageActionsController } from "../hooks/useMessageActionsController";
import { getAvailableActions } from "../lib/actionMatrix";
import type { ChatDetails, Message } from "../types";
import { DeleteMessageModal } from "./DeleteMessageModal";
import { EditMessageModal } from "./EditMessageModal";
import { ForwardModal } from "./ForwardModal";
import { MessageContextMenu } from "./MessageContextMenu";
import { ReactionsPicker } from "./ReactionsPicker";

const Context = createContext<UI | null>(null);
export function useMessageActionUI() {
  const ui = useContext(Context);
  if (!ui) throw new Error("Message actions provider missing");
  return ui;
}
export function MessageActionsProvider({
  chat,
  messages,
  onReply,
  onNavigate,
  children,
}: {
  chat: ChatDetails;
  messages: Message[];
  onReply: (message: Message) => void;
  onNavigate: (id: string) => void;
  children: ReactNode;
}) {
  const {
    user,
    say,
    actions,
    reactions,
    busy,
    selected,
    notice,
    setNotice,
    close,
    message,
    run,
    choose,
    ui,
    forward,
  } = useMessageActionsController({ chat, messages, onReply, onNavigate });
  return (
    <Context value={ui}>
      {children}
      {notice && (
        <div className="message-action-notice" role="status">
          {notice}
          <button type="button" aria-label={say("Dismiss", "Cerrar")} onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      {selected &&
        message &&
        (selected.mode === "menu" ? (
          <MessageContextMenu
            message={message}
            point={selected.point ?? { x: 20, y: 80 }}
            readOnly={chat.readOnly}
            onChoose={choose}
            onClose={close}
          />
        ) : selected.mode === "react" ? (
          <ReactionsPicker
            limited={!!chat.channelMode}
            busy={busy}
            mine={message.reactions.find((r) => r.user_id === user?.id)?.emoji}
            onClose={close}
            onSelect={(emoji) => {
              close();
              void run(() => reactions.toggle(message, emoji));
            }}
          />
        ) : selected.mode === "edit" ? (
          <EditMessageModal
            message={message}
            busy={busy}
            onSave={(text) => actions.edit(message, text)}
            onClose={close}
          />
        ) : selected.mode === "delete" ? (
          <DeleteMessageModal
            everyone={getAvailableActions(message, user?.id ?? "", chat.readOnly).includes(
              "delete_for_everyone",
            )}
            busy={busy}
            onDelete={(all) =>
              all ? actions.deleteForEveryone(message) : actions.deleteForMe(message)
            }
            onClose={close}
          />
        ) : (
          <ForwardModal busy={busy} onForward={forward} onClose={close} />
        ))}
    </Context>
  );
}
