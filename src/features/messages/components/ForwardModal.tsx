import { useRef, useState } from "react";
import { Modal } from "@/features/auth/components";
import { useChats } from "@/features/chats/hooks/useChats";
import { useMessageText } from "../i18n";
export function ForwardModal({
  onForward,
  onClose,
  busy,
}: {
  onForward: (chats: string[], ids: string[]) => Promise<void>;
  onClose: () => void;
  busy: boolean;
}) {
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
  return (
    <Modal
      title={say("Forward message", "Reenviar mensaje")}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <input
        type="search"
        className="input"
        aria-label={say("Search chats", "Buscar chats")}
        placeholder={say("Search chats", "Buscar chats")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <p>
        {say("Select up to 5 chats", "Selecciona hasta 5 chats")} · {selected.length}/5
      </p>
      <div className="forward-chats">
        {options.map((chat) => (
          <label key={chat.id}>
            <input
              type="checkbox"
              checked={selected.includes(chat.id)}
              disabled={busy}
              onChange={() => {
                if (selected.includes(chat.id))
                  setSelected(selected.filter((id) => id !== chat.id));
                else if (selected.length < 5) {
                  setSelected([...selected, chat.id]);
                  setError("");
                } else
                  setError(
                    say("You can select at most 5 chats.", "Puedes seleccionar hasta 5 chats."),
                  );
              }}
            />
            {chat.displayName}
          </label>
        ))}
      </div>
      {chats.isPending && <p role="status">{say("Loading…", "Cargando…")}</p>}
      {chats.isError && (
        <button type="button" className="button secondary" onClick={() => void chats.refetch()}>
          {say("Reload chats", "Recargar chats")}
        </button>
      )}
      {!chats.isPending && !chats.isError && !options.length && (
        <p>{say("No available chats", "No hay chats disponibles")}</p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
          {say("Cancel", "Cancelar")}
        </button>
        <button
          type="button"
          className="button primary"
          disabled={busy || !selected.length}
          onClick={async () => {
            setError("");
            try {
              await onForward(
                selected,
                selected.map((id) => {
                  if (!identifiers.current.has(id))
                    identifiers.current.set(id, crypto.randomUUID());
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
          }}
        >
          {say("Forward", "Reenviar")}
        </button>
      </div>
    </Modal>
  );
}
