import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { useMessageActions } from "../hooks/useMessageActions";
import { useReactions } from "../hooks/useReactions";
import { useMessageText } from "../i18n";
import { getAvailableActions, type MessageAction } from "../lib/actionMatrix";
import type { ChatDetails, Message } from "../types";
import { DeleteMessageModal } from "./DeleteMessageModal";
import { EditMessageModal } from "./EditMessageModal";
import { ForwardModal } from "./ForwardModal";
import { MessageContextMenu } from "./MessageContextMenu";
import { ReactionsPicker } from "./ReactionsPicker";

type UI = {
  openMenu: (message: Message, point: { x: number; y: number }) => void;
  openReactions: (message: Message) => void;
  react: (message: Message, emoji: string) => void;
  navigate: (id: string) => void;
  unpin: (message: Message) => void;
  busy: boolean;
  readOnly: boolean;
};
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
  const { user } = useAuth();
  const { say } = useMessageText();
  const actions = useMessageActions(chat.id);
  const reactions = useReactions(chat.id);
  const busy = actions.busy || reactions.busy;
  const [selected, setSelected] = useState<{
    message: Message;
    mode: "menu" | "react" | "edit" | "delete" | "forward";
    point?: { x: number; y: number };
  }>();
  const [notice, setNotice] = useState("");
  const close = useCallback(() => setSelected(undefined), []);
  const message =
    selected && (messages.find((m) => m.id === selected.message.id) ?? selected.message);
  const run = async (operation: () => Promise<unknown>) => {
    if (busy) return;
    setNotice("");
    try {
      await operation();
    } catch (error) {
      const text =
        error && typeof error === "object" && "message" in error ? String(error.message) : "";
      setNotice(
        text.includes("3 messages")
          ? say(
              "A chat can have at most 3 pinned messages.",
              "Un chat puede tener hasta 3 mensajes fijados.",
            )
          : say(
              "Unable to complete this action. Please try again.",
              "No se pudo completar la acción. Inténtalo de nuevo.",
            ),
      );
    }
  };
  const choose = (action: MessageAction) => {
    if (!message || busy) return;
    close();
    switch (action) {
      case "reply":
        onReply(message);
        break;
      case "react":
        setSelected({ message, mode: "react" });
        break;
      case "copy":
        void run(async () => {
          await actions.copy(message.content ?? "");
          setNotice(say("Text copied", "Texto copiado"));
        });
        break;
      case "pin":
      case "unpin":
        void run(() => actions.pin(message, action === "pin"));
        break;
      case "edit":
        setSelected({ message, mode: "edit" });
        break;
      case "forward":
        setSelected({ message, mode: "forward" });
        break;
      default:
        setSelected({ message, mode: "delete" });
    }
  };
  return (
    <Context
      value={{
        busy,
        readOnly: chat.readOnly,
        navigate: onNavigate,
        openMenu: (m, point) => {
          if (!busy && getAvailableActions(m, user?.id ?? "", chat.readOnly).length)
            setSelected({ message: m, point, mode: "menu" });
        },
        openReactions: (m) => {
          if (!busy && !chat.readOnly && !m.localStatus && !m.deleted_for_everyone)
            setSelected({ message: m, mode: "react" });
        },
        react: (m, emoji) => {
          if (!chat.readOnly) void run(() => reactions.toggle(m, emoji));
        },
        unpin: (m) => {
          if (!chat.readOnly) void run(() => actions.pin(m, false));
        },
      }}
    >
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
            busy={busy}
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
          <ForwardModal
            busy={busy}
            onForward={async (chats, ids) => {
              await actions.forward(message, chats, ids);
              setNotice(
                say(`Forwarded to ${chats.length} chats`, `Reenviado a ${chats.length} chats`),
              );
            }}
            onClose={close}
          />
        ))}
    </Context>
  );
}
