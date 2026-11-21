import { Lock } from "lucide-react";
import { isSilenced } from "@/features/roles/lib/permissions";
import { useMessageText } from "../i18n";

export function RestrictedComposerNotice({
  silencedUntil,
}: {
  silencedUntil?: string | null;
} = {}) {
  const { say, language } = useMessageText();
  const silenced = isSilenced(silencedUntil);
  return (
    <div
      className="restricted-composer-notice"
      data-slot="restricted-composer-notice"
      role="status"
    >
      <Lock size={15} aria-hidden="true" />
      <span>
        {silenced && silencedUntil
          ? say(
              `You are silenced until ${new Intl.DateTimeFormat(language, {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(silencedUntil))}`,
              `Estás silenciado hasta ${new Intl.DateTimeFormat(language, {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(silencedUntil))}`,
            )
          : say(
              "Only authorized roles can send messages here",
              "Solo los roles autorizados pueden enviar mensajes aquí",
            )}
      </span>
    </div>
  );
}
