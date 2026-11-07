import { Button } from "@/components/ui/button";
import { ChatSettingsDialog } from "@/components/ui/chat-settings-surfaces";
import { useMessageText } from "@/features/messages/i18n";
import { muteUntil } from "../lib/chatActions";
export function MuteSubmenu({
  muted,
  busy,
  onChoose,
  onClose,
  error,
}: {
  muted: boolean;
  busy: boolean;
  onChoose: (until: string | null) => void;
  onClose: () => void;
  error?: string;
}) {
  const { say } = useMessageText();
  return (
    <ChatSettingsDialog
      title={say("Mute notifications", "Silenciar notificaciones")}
      onClose={onClose}
      canClose={!busy}
    >
      {(dismiss) => (
        <>
          {error && <p role="alert">{error}</p>}
          <div className="mute-options">
            {[
              { hours: 1, label: say("1 hour", "1 hora") },
              { hours: 8, label: say("8 hours", "8 horas") },
              { hours: 24, label: say("1 day", "1 día") },
              { hours: 168, label: say("1 week", "1 semana") },
              { hours: Infinity, label: say("Always", "Siempre") },
            ].map(({ hours, label }) => (
              <Button
                type="button"
                variant="outline"
                key={label}
                disabled={busy}
                onClick={() => onChoose(muteUntil(hours))}
              >
                {label}
              </Button>
            ))}
            {muted && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => onChoose(null)}
              >
                {say("Unmute", "Activar sonido")}
              </Button>
            )}
          </div>
          <Button type="button" variant="outline" disabled={busy} onClick={dismiss}>
            {say("Cancel", "Cancelar")}
          </Button>
        </>
      )}
    </ChatSettingsDialog>
  );
}
