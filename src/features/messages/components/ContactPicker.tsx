import { useState } from "react";
import { Modal } from "@/features/auth/components";
import { useChats } from "@/features/chats/hooks/useChats";
import { Avatar } from "@/features/settings/components/shared";
import { useMessageText } from "../i18n";
import type { SendInput } from "../types";
export function ContactPicker({
  onSend,
  onClose,
}: {
  onSend: (input: SendInput) => Promise<void>;
  onClose: () => void;
}) {
  const contacts = useChats();
  const { say } = useMessageText();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const rows = [
    ...new Map(
      (contacts.data ?? [])
        .filter((c) => c.type === "direct" && !c.isBlocked && c.otherUsername)
        .map((c) => [c.otherUserId, c]),
    ).values(),
  ].filter((c) =>
    `${c.displayName} ${c.otherUsername}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Modal
      title={say("Share a contact", "Compartir un contacto")}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <input
        aria-label={say("Search contacts", "Buscar contactos")}
        placeholder={say("Search contacts…", "Buscar contactos…")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="contact-picker-list">
        {rows.map((c) => (
          <button
            type="button"
            disabled={busy}
            key={c.id}
            onClick={async () => {
              setBusy(true);
              try {
                await onSend({
                  type: "contact",
                  content: null,
                  contact_data: {
                    user_id: c.otherUserId,
                    username: c.otherUsername,
                    display_name: c.displayName,
                  },
                });
                onClose();
              } catch {
                setError(true);
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            <Avatar
              profile={{ id: c.otherUserId, display_name: c.displayName, avatar_url: c.avatarUrl }}
              size="small"
            />
            <span>
              {c.displayName}
              <small>@{c.otherUsername}</small>
            </span>
          </button>
        ))}
      </div>
      {!rows.length && (
        <p>
          {contacts.isPending
            ? say("Loading…", "Cargando…")
            : say(
                "No contacts yet. Contacts come from your direct chats.",
                "Aún no hay contactos. Se muestran los contactos de tus chats directos.",
              )}
        </p>
      )}
      {(error || contacts.isError) && (
        <p role="alert">
          {say("Unable to load or send contact", "No se pudo cargar o enviar el contacto")}
        </p>
      )}
      <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
        {say("Cancel", "Cancelar")}
      </button>
    </Modal>
  );
}
