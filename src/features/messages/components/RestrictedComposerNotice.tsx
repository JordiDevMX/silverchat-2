import { Lock } from "lucide-react";
import { useMessageText } from "../i18n";

export function RestrictedComposerNotice() {
  const { say } = useMessageText();
  return (
    <div
      className="restricted-composer-notice"
      data-slot="restricted-composer-notice"
      role="status"
    >
      <Lock size={15} aria-hidden="true" />
      <span>
        {say(
          "Only admins are allowed to chat here",
          "Solo los administradores pueden enviar mensajes aquí",
        )}
      </span>
    </div>
  );
}
