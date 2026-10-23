import { useRef, useState } from "react";
import { Modal } from "@/features/auth/components";
import { useMessageText } from "@/features/messages/i18n";
import type { ChatDetails, Profile } from "@/features/messages/types";
import { Avatar } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { useAddMembers } from "../hooks/useAddMembers";
import { toggleMember } from "../lib/chatActions";
import { useChatUIStore } from "../stores/uiStore";
export function AddMembersModal({ chat }: { chat: ChatDetails }) {
  const { say } = useMessageText();
  const { user } = useAuth();
  const ui = useChatUIStore();
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const names = useRef(new Map<string, string>());
  const hook = useAddMembers(chat.id, text);
  const excluded = new Set([user?.id, ...chat.members.map((m) => m.user_id)]);
  const contacts = (hook.contacts.data ?? []).filter((p) => p.id && !excluded.has(p.id));
  const other = (hook.search.data ?? []).filter(
    (p) => p.id && !excluded.has(p.id) && !contacts.some((c) => c.id === p.id),
  );
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
    <Modal
      title={say("Add members", "Añadir miembros")}
      className="chat-settings-modal"
      onClose={hook.busy ? undefined : ui.close}
    >
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
          <button
            type="button"
            key={id}
            disabled={hook.busy}
            onClick={() => setSelected(selected.filter((value) => value !== id))}
          >
            {names.current.get(id)} ×
          </button>
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
          <button type="button" onClick={() => void hook.contacts.refetch()}>
            {say("Reload contacts", "Recargar contactos")}
          </button>
        )}
        {hook.term && (
          <>
            <h3>{say("Other users", "Otros usuarios")}</h3>
            {hook.search.isFetching && <p role="status">{say("Searching…", "Buscando…")}</p>}
            {hook.search.isError ? (
              <button type="button" onClick={() => void hook.search.refetch()}>
                {say("Retry search", "Reintentar búsqueda")}
              </button>
            ) : (
              other.map(row)
            )}
          </>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="button secondary" disabled={hook.busy} onClick={ui.close}>
          {say("Cancel", "Cancelar")}
        </button>
        <button
          type="button"
          className="button primary"
          disabled={hook.busy || !selected.length || chat.own?.role !== "admin"}
          onClick={async () => {
            setError("");
            try {
              const count = await hook.add(selected);
              ui.notify(say(`Added ${count} members`, `Se añadieron ${count} miembros`));
              ui.close();
            } catch {
              setError(
                say(
                  "Unable to add members. Try again.",
                  "No se pudieron añadir miembros. Inténtalo de nuevo.",
                ),
              );
            }
          }}
        >
          {say(`Add ${selected.length} members`, `Añadir ${selected.length} miembros`)}
        </button>
      </div>
    </Modal>
  );
}
