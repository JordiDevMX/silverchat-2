import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/features/auth/components";
import { useForwardDialog } from "../hooks/useForwardDialog";
export function ForwardModal({
  onForward,
  onClose,
  busy,
}: {
  onForward: (chats: string[], ids: string[]) => Promise<void>;
  onClose: () => void;
  busy: boolean;
}) {
  const { chats, say, search, setSearch, selected, error, options, toggle, forward } =
    useForwardDialog(onForward, onClose);
  return (
    <Modal
      className="messaging-dialog"
      title={say("Forward message", "Reenviar mensaje")}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <Input
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
              onChange={() => toggle(chat.id)}
            />
            {chat.displayName}
          </label>
        ))}
      </div>
      {chats.isPending && <p role="status">{say("Loading…", "Cargando…")}</p>}
      {chats.isError && (
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={() => void chats.refetch()}
        >
          {say("Reload chats", "Recargar chats")}
        </Button>
      )}
      {!chats.isPending && !chats.isError && !options.length && (
        <p>{say("No available chats", "No hay chats disponibles")}</p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={busy}
          onClick={onClose}
        >
          {say("Cancel", "Cancelar")}
        </Button>
        <Button
          type="button"
          className="rounded-xl"
          disabled={busy || !selected.length}
          onClick={forward}
        >
          {say("Forward", "Reenviar")}
        </Button>
      </div>
    </Modal>
  );
}
