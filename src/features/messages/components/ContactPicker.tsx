import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/features/auth/components";
import { Avatar } from "@/features/settings/components/shared";
import { useContactPicker } from "../hooks/useContactPicker";
import { useMessageText } from "../i18n";
import type { SendInput } from "../types";
export function ContactPicker({
  onSend,
  onClose,
}: {
  onSend: (input: SendInput) => Promise<void>;
  onClose: () => void;
}) {
  const { say } = useMessageText();
  const { contacts, query, setQuery, busy, error, rows, sendContact } = useContactPicker(
    onSend,
    onClose,
  );
  return (
    <Modal
      className="messaging-dialog"
      title={say("Share a contact", "Compartir un contacto")}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <Input
        aria-label={say("Search contacts", "Buscar contactos")}
        placeholder={say("Search contacts…", "Buscar contactos…")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="contact-picker-list">
        {rows.map((c) => (
          <button type="button" disabled={busy} key={c.id} onClick={() => void sendContact(c)}>
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
      <Button
        type="button"
        variant="outline"
        className="rounded-xl"
        disabled={busy}
        onClick={onClose}
      >
        {say("Cancel", "Cancelar")}
      </Button>
    </Modal>
  );
}
