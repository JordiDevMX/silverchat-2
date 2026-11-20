import { Ban, EyeOff, Flag, MessageSquareWarning, ShieldAlert, X } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { ChatSettingsDialog } from "@/components/ui/chat-settings-surfaces";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-provider";
import { useReportDialog } from "../hooks/useChatDialogActions";
import { type ReportReason, type ReportTarget, validReport } from "../lib/chatActions";

export type { ReportTarget };

export function ReportModal({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const { user } = useAuth();
  const {
    say,
    mutation,
    reason,
    setReason,
    description,
    setDescription,
    alsoBlock,
    setAlsoBlock,
    submit,
  } = useReportDialog(target, onClose);
  const baseId = useId();
  const detailsId = `${baseId}-details`;
  const counterId = `${baseId}-counter`;
  const blockId = `${baseId}-block`;
  const blockTitleId = `${blockId}-title`;
  const blockHintId = `${blockId}-hint`;

  const canBlock = Boolean(target.blockUserId && target.blockUserId !== user?.id);
  const isChannel = target.kind === "channel";
  const targetHandle = isChannel
    ? target.slug
      ? `@${target.slug}`
      : null
    : target.username
      ? `@${target.username}`
      : null;

  const reasons: Array<{
    value: ReportReason;
    icon: typeof Ban;
    label: string;
    hint: string;
  }> = [
    {
      value: "spam",
      icon: Ban,
      label: say("Spam", "Spam"),
      hint: say(
        "Unwanted promotion, scams, or repetitive posts",
        "Promoción no deseada, estafas o publicaciones repetitivas",
      ),
    },
    {
      value: "harassment",
      icon: ShieldAlert,
      label: say("Harassment", "Acoso"),
      hint: say(
        "Abuse, threats, intimidation, or targeted attacks",
        "Abuso, amenazas, intimidación o ataques directos",
      ),
    },
    {
      value: "inappropriate",
      icon: EyeOff,
      label: say("Inappropriate content", "Contenido inapropiado"),
      hint: say(
        "Harmful, explicit, hateful, or illegal material",
        "Material dañino, explícito, de odio o ilegal",
      ),
    },
    {
      value: "other",
      icon: MessageSquareWarning,
      label: say("Other", "Otro"),
      hint: say(
        "Another safety concern not listed above",
        "Otro problema de seguridad no listado arriba",
      ),
    },
  ];

  return (
    <ChatSettingsDialog
      title={
        isChannel ? say("Report channel", "Reportar canal") : say("Report user", "Reportar usuario")
      }
      className="report-dialog"
      onClose={onClose}
      canClose={!mutation.isPending}
    >
      {(dismiss) => (
        <div className="report-modal-body">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="report-close"
            disabled={mutation.isPending}
            aria-label={say("Close", "Cerrar")}
            onClick={dismiss}
          >
            <X size={18} aria-hidden="true" />
          </Button>

          <div className="report-target-card">
            <span className="report-target-badge" aria-hidden="true">
              <Flag size={16} />
            </span>
            <div className="report-target-copy">
              <strong>{target.name}</strong>
              {targetHandle && <small>{targetHandle}</small>}
            </div>
            <span className="report-target-pill">
              {isChannel
                ? say("Public channel", "Canal público")
                : say("Public profile", "Perfil público")}
            </span>
          </div>

          <form
            className="report-form"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <fieldset className="report-fieldset">
              <legend>{say("What’s the issue?", "¿Cuál es el problema?")}</legend>
              <div className="report-reason-list">
                {reasons.map(({ value, icon: Icon, label, hint }) => {
                  const radioId = `${baseId}-reason-${value}`;
                  const titleId = `${radioId}-title`;
                  const hintId = `${radioId}-hint`;
                  return (
                    <label className="report-reason-option" htmlFor={radioId} key={value}>
                      <span className="report-reason-icon" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <span className="report-reason-copy">
                        <strong id={titleId}>{label}</strong>
                        <small id={hintId}>{hint}</small>
                      </span>
                      <input
                        id={radioId}
                        type="radio"
                        name="report-reason"
                        value={value}
                        checked={reason === value}
                        disabled={mutation.isPending}
                        aria-labelledby={titleId}
                        aria-describedby={hintId}
                        onChange={() => setReason(value)}
                      />
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="report-details-field">
              <div className="report-details-header">
                <label htmlFor={detailsId}>{say("Details", "Detalles")}</label>
                <span>
                  {reason === "other" ? say("Required", "Requerido") : say("Optional", "Opcional")}
                </span>
              </div>
              <textarea
                id={detailsId}
                rows={2}
                maxLength={500}
                value={description}
                disabled={mutation.isPending}
                aria-describedby={counterId}
                placeholder={say(
                  "Add context that helps moderators review this public space…",
                  "Añade contexto para ayudar a revisar este espacio público…",
                )}
                onChange={(e) => setDescription(e.target.value)}
                required={reason === "other"}
              />
              <small id={counterId} className="report-char-count">
                {description.length}/500
              </small>
            </div>

            {canBlock && (
              <div className="report-block-option" data-checked={alsoBlock || undefined}>
                <label htmlFor={blockId} className="report-block-copy">
                  <strong id={blockTitleId}>
                    {isChannel
                      ? say(
                          "Also block this channel’s creator",
                          "Bloquear también al creador de este canal",
                        )
                      : say(`Also block ${target.name}`, `Bloquear también a ${target.name}`)}
                  </strong>
                  <small id={blockHintId}>
                    {say(
                      "They won’t be able to message you, and you won’t see their messages.",
                      "No podrá enviarte mensajes y no verás sus mensajes.",
                    )}
                  </small>
                </label>
                <Switch
                  id={blockId}
                  checked={alsoBlock}
                  disabled={mutation.isPending}
                  aria-labelledby={blockTitleId}
                  aria-describedby={blockHintId}
                  onCheckedChange={setAlsoBlock}
                />
              </div>
            )}

            {mutation.isError && (
              <p className="report-error" role="alert">
                {say(
                  "Report could not be submitted. Try again.",
                  "No se pudo enviar el reporte. Inténtalo de nuevo.",
                )}
              </p>
            )}

            <div className="modal-actions">
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={dismiss}
              >
                {say("Cancel", "Cancelar")}
              </Button>
              <Button
                type="submit"
                variant={alsoBlock && canBlock ? "destructive" : "default"}
                disabled={mutation.isPending || !validReport(reason, description)}
              >
                {alsoBlock && canBlock
                  ? say("Report and block", "Reportar y bloquear")
                  : say("Submit report", "Enviar reporte")}
              </Button>
            </div>
          </form>
        </div>
      )}
    </ChatSettingsDialog>
  );
}
