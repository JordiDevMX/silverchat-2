import { Button } from "@/components/ui/button";
import { ChatSettingsDialog } from "@/components/ui/chat-settings-surfaces";
import type { ChatDetails, Profile } from "@/features/messages/types";
import { Avatar } from "@/features/settings/components/shared";
import { useAddMembersDialog } from "../hooks/useAddMembersDialog";
import { toggleMember } from "../lib/chatActions";
export function AddMembersModal({
  chat,
  context = "group",
  onClose,
}: {
  chat: ChatDetails;
  context?: "group" | "community";
  onClose?: () => void;
}) {
  const {
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
  } = useAddMembersDialog(chat, context, onClose);
  const row = (p: Profile) =>
    p.id && (
      <label className="member-choice" key={p.id}>
        <input
          type="checkbox"
          checked={selected.includes(p.id)}
          disabled={hook.busy}
          onChange={() => {
            if (!p.id) return;
            try {
              setSelected(toggleMember(selected, p.id));
              names.current.set(p.id, p.display_name ?? p.username ?? "");
              setError("");
            } catch {
              setError(
                say(
                  "You can select up to 50 members at once",
                  "Puedes seleccionar hasta 50 miembros a la vez",
                ),
              );
            }
          }}
        />
        <Avatar profile={p} size="small" />
        <span>
          {p.display_name}
          <small>@{p.username}</small>
        </span>
      </label>
    );
  return (
    <ChatSettingsDialog
      title={say("Add members", "Añadir miembros")}
      onClose={close}
      canClose={!hook.busy}
    >
      {(dismiss) => (
        <>
          <input
            type="search"
            className="input"
            aria-label={say("Search by name or username", "Buscar por nombre o usuario")}
            placeholder={say("Search by name or @username", "Buscar por nombre o @usuario")}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="selected-members">
            {selected.map((id) => (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                key={id}
                disabled={hook.busy}
                onClick={() => setSelected(selected.filter((value) => value !== id))}
              >
                {names.current.get(id)} ×
              </Button>
            ))}
          </div>
          <p>
            {selected.length}/50 {say("selected", "seleccionados")}
          </p>
          <div className="member-candidates">
            <h3>{say("Contacts", "Contactos")}</h3>
            {contacts
              .filter((p) =>
                `${p.display_name} ${p.username}`
                  .toLocaleLowerCase()
                  .includes(text.replace(/^@/, "").toLocaleLowerCase()),
              )
              .map(row)}
            {hook.contacts.isPending && <p>{say("Loading…", "Cargando…")}</p>}
            {hook.contacts.isError && (
              <Button variant="outline" type="button" onClick={() => void hook.contacts.refetch()}>
                {say("Reload contacts", "Recargar contactos")}
              </Button>
            )}
            {hook.term && (
              <>
                <h3>{say("Other users", "Otros usuarios")}</h3>
                {hook.search.isFetching && <p role="status">{say("Searching…", "Buscando…")}</p>}
                {hook.search.isError ? (
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => void hook.search.refetch()}
                  >
                    {say("Retry search", "Reintentar búsqueda")}
                  </Button>
                ) : (
                  other.map(row)
                )}
              </>
            )}
          </div>
          {error && <p role="alert">{error}</p>}
          <div className="modal-actions">
            <Button type="button" variant="outline" disabled={hook.busy} onClick={dismiss}>
              {say("Cancel", "Cancelar")}
            </Button>
            <Button
              type="button"
              disabled={hook.busy || !selected.length || chat.own?.role !== "admin"}
              onClick={submit}
            >
              {say(`Add ${selected.length} members`, `Añadir ${selected.length} miembros`)}
            </Button>
          </div>
        </>
      )}
    </ChatSettingsDialog>
  );
}
