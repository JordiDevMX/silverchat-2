import { Copy, Forward, Pencil, Pin, PinOff, Reply, SmilePlus, Trash2 } from "lucide-react";
import { type CSSProperties, Fragment } from "react";
import { createPortal } from "react-dom";
import { useMessageMenu } from "../hooks/useMessageMenu";
import type { MessageAction } from "../lib/actionMatrix";
import type { Message } from "../types";

const actionIcons = {
  reply: Reply,
  react: SmilePlus,
  copy: Copy,
  forward: Forward,
  pin: Pin,
  unpin: PinOff,
  edit: Pencil,
  delete_for_me: Trash2,
  delete_for_everyone: Trash2,
};

export function MessageContextMenu({
  message,
  point,
  readOnly,
  onChoose,
  onClose,
}: {
  message: Message;
  point: { x: number; y: number };
  readOnly: boolean;
  onChoose: (action: MessageAction) => void;
  onClose: () => void;
}) {
  const { ref, actions, labels, say } = useMessageMenu(message, readOnly, onClose);
  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={say("Message actions", "Acciones del mensaje")}
      className="message-context-menu"
      style={
        {
          "--menu-left": `${Math.max(8, Math.min(point.x, window.innerWidth - 240))}px`,
          "--menu-top": `${Math.max(8, Math.min(point.y, window.innerHeight - actions.length * 42 - 20))}px`,
        } as CSSProperties
      }
    >
      {actions.map((action, index) => {
        const Icon = actionIcons[action];
        return (
          <Fragment key={action}>
            {index > 0 &&
              action.startsWith("delete") &&
              !actions[index - 1]?.startsWith("delete") && (
                <hr className="message-context-menu-separator" />
              )}
            <button
              type="button"
              role="menuitem"
              className={action.startsWith("delete") ? "danger" : ""}
              onClick={() => onChoose(action)}
            >
              <Icon size={17} aria-hidden="true" />
              {labels[action]}
            </button>
          </Fragment>
        );
      })}
    </div>,
    document.body,
  );
}
