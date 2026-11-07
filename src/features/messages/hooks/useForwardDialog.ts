import { useRef, useState } from "react";
import { useChats } from "@/features/chats/hooks/useChats";
import { useMessageText } from "../i18n";
export function useForwardDialog(
  onForward: (chats: string[], ids: string[]) => Promise<void>,
  onClose: () => void,
) {
  const chats = useChats();
  const { say } = useMessageText();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const identifiers = useRef(new Map<string, string>());
  const options = (chats.data ?? []).filter(
    (c) =>
      !c.archivedAt &&
      !c.isBlocked &&
      c.displayName.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const toggle = (id: string) => {
    if (selected.includes(id)) setSelected(selected.filter((selectedId) => selectedId !== id));
    else if (selected.length < 5) {
      setSelected([...selected, id]);
      setError("");
    } else setError(say("You can select at most 5 chats.", "Puedes seleccionar hasta 5 chats."));
  };
  const forward = async () => {
    setError("");
    try {
      await onForward(
        selected,
        selected.map((id) => {
          if (!identifiers.current.has(id)) identifiers.current.set(id, crypto.randomUUID());
          return identifiers.current.get(id) as string;
        }),
      );
      onClose();
    } catch {
      setError(
        say(
          "Forward failed. Try again; confirmed copies will not be duplicated.",
          "No se pudo reenviar. Reintenta; las copias confirmadas no se duplicarán.",
        ),
      );
    }
  };
  return { chats, say, search, setSearch, selected, error, options, toggle, forward };
}
