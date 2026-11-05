import { useRef, useState } from "react";
import { useMessageText } from "@/features/messages/i18n";
import type { ChatDetails } from "@/features/messages/types";
import { useAuth } from "@/lib/auth-provider";
import { useChatUIStore } from "../stores/uiStore";
import { useAddMembers } from "./useAddMembers";
export function useAddMembersDialog(
  chat: ChatDetails,
  context: "group" | "community",
  onClose?: () => void,
) {
  const { say } = useMessageText();
  const { user } = useAuth();
  const ui = useChatUIStore();
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const names = useRef(new Map<string, string>());
  const hook = useAddMembers(chat.id, text, context);
  const close = onClose ?? ui.close;
  const excluded = new Set([user?.id, ...chat.members.map((m) => m.user_id)]);
  const contacts = (hook.contacts.data ?? []).filter((p) => p.id && !excluded.has(p.id));
  const other = (hook.search.data ?? []).filter(
    (p) => p.id && !excluded.has(p.id) && !contacts.some((c) => c.id === p.id),
  );

  const submit = async () => {
    setError("");
    try {
      const count = await hook.add(selected);
      ui.notify(say(`Added ${count} members`, `Se añadieron ${count} miembros`));
      close();
    } catch {
      setError(
        say(
          "Unable to add members. Try again.",
          "No se pudieron añadir miembros. Inténtalo de nuevo.",
        ),
      );
    }
  };
  return {
    say,
    text,
    setText,
    selected,
    setSelected,
    error,
    setError,
    names,
    hook,
    close,
    contacts,
    other,
    submit,
  };
}
