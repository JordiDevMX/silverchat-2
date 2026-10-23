import { Modal } from "@/features/auth/components";
import { useMessageText } from "@/features/messages/i18n";
import { muteUntil } from "../lib/chatActions";
export function MuteSubmenu({
  muted,
  busy,
  onChoose,
  onClose,
}: {
  muted: boolean;
  busy: boolean;
  onChoose: (until: string | null) => void;
  onClose: () => void;
}) {
  const { say } = useMessageText();
  return (
    <Modal
      title={say("Mute notifications", "Silenciar notificaciones")}
      onClose={busy ? undefined : onClose}
    >
      <div className="mute-options">
        {[
          { hours: 1, label: say("1 hour", "1 hora") },
          { hours: 8, label: say("8 hours", "8 horas") },
          { hours: 24, label: say("1 day", "1 día") },
          { hours: 168, label: say("1 week", "1 semana") },
          { hours: Infinity, label: say("Always", "Siempre") },
        ].map(({ hours, label }) => (
          <button
            type="button"
            className="button secondary"
            key={label}
            disabled={busy}
            onClick={() => onChoose(muteUntil(hours))}
          >
            {label}
          </button>
        ))}
        {muted && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => onChoose(null)}
          >
            {say("Unmute", "Activar sonido")}
          </button>
        )}
      </div>
      <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
        {say("Cancel", "Cancelar")}
      </button>
    </Modal>
  );
}
