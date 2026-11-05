import { Button } from "@/components/ui/button";
import { ChatSettingsDialog } from "@/components/ui/chat-settings-surfaces";
import { useReportDialog } from "../hooks/useChatDialogActions";
import { validReport } from "../lib/chatActions";
export function ReportModal({ userId, name }: { userId: string; name: string }) {
  const { say, ui, mutation, reason, setReason, description, setDescription, submit } =
    useReportDialog(userId);
  return (
    <ChatSettingsDialog
      title={`${say("Report", "Reportar")} ${name}`}
      onClose={ui.close}
      canClose={!mutation.isPending}
    >
      {(dismiss) => (
        <>
          <fieldset>
            <legend>
              {say("Why are you reporting this user?", "¿Por qué reportas a este usuario?")}
            </legend>
            {(["spam", "harassment", "inappropriate", "other"] as const).map((value, i) => (
              <label className="report-reason" key={value}>
                <input
                  type="radio"
                  name="report-reason"
                  checked={reason === value}
                  onChange={() => setReason(value)}
                />
                {
                  [
                    say("Spam", "Spam"),
                    say("Harassment or bullying", "Acoso"),
                    say("Inappropriate content", "Contenido inapropiado"),
                    say("Other", "Otro"),
                  ][i]
                }
              </label>
            ))}
          </fieldset>
          <label className="field">
            {say("Description", "Descripción")}
            <textarea
              rows={4}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required={reason === "other"}
            />
          </label>
          <small>{description.length}/500</small>
          {mutation.isError && (
            <p role="alert">
              {say(
                "Report could not be submitted. Try again.",
                "No se pudo enviar el reporte. Inténtalo de nuevo.",
              )}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={dismiss}>
              {say("Cancel", "Cancelar")}
            </Button>
            <Button
              type="button"
              disabled={mutation.isPending || !validReport(reason, description)}
              onClick={submit}
            >
              {say("Submit report", "Enviar reporte")}
            </Button>
          </div>
        </>
      )}
    </ChatSettingsDialog>
  );
}
