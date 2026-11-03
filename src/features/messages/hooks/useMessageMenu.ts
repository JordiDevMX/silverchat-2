import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { useMessageText } from "../i18n";
import { getAvailableActions, type MessageAction } from "../lib/actionMatrix";
import type { Message } from "../types";
export function useMessageMenu(message: Message, readOnly: boolean, onClose: () => void) {
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
  return { ref, actions, labels, say };
}
