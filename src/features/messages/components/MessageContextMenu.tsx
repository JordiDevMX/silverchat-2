import { type CSSProperties, Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth-provider";
import { useMessageText } from "../i18n";
import { getAvailableActions, type MessageAction } from "../lib/actionMatrix";
import type { Message } from "../types";
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
  const { user } = useAuth();
  const { say } = useMessageText();
  const ref = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(Date.now());
  const actions = getAvailableActions(message, user?.id ?? "", readOnly, now);
  const labels: Record<MessageAction, string> = {
    reply: say("Reply", "Responder"),
    react: say("React", "Reaccionar"),
    copy: say("Copy text", "Copiar texto"),
    forward: say("Forward", "Reenviar"),
    pin: say("Pin", "Fijar"),
    unpin: say("Unpin", "Desfijar"),
    edit: say("Edit", "Editar"),
    delete_for_me: say("Delete for me", "Eliminar para mí"),
    delete_for_everyone: say("Delete for everyone", "Eliminar para todos"),
  };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector("button")?.focus();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const click = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Tab") onClose();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const buttons = [...(ref.current?.querySelectorAll("button") ?? [])];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[
          (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length
        ]?.focus();
      }
    };
    document.addEventListener("pointerdown", click);
    document.addEventListener("keydown", key);
    return () => {
      clearInterval(timer);
      document.removeEventListener("pointerdown", click);
      document.removeEventListener("keydown", key);
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);
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
      {actions.map((action, index) => (
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
            {labels[action]}
          </button>
        </Fragment>
      ))}
    </div>,
    document.body,
  );
}
