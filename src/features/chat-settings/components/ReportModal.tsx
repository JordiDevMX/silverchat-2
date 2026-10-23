import { useState } from "react";
import { Modal } from "@/features/auth/components";
import { useMessageText } from "@/features/messages/i18n";
import { type ReportReason, useReportUser } from "../hooks/useReportUser";
import { validReport } from "../lib/chatActions";
import { useChatUIStore } from "../stores/uiStore";
export function ReportModal({ userId, name }: { userId: string; name: string }) {
  const { say } = useMessageText();
  const ui = useChatUIStore();
  const mutation = useReportUser();
  const [reason, setReason] = useState<ReportReason>("spam");
  const [description, setDescription] = useState("");
  return (
    <Modal
      title={`${say("Report", "Reportar")} ${name}`}
      className="chat-settings-modal"
      onClose={mutation.isPending ? undefined : ui.close}
    >
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
        <button
          type="button"
          className="button secondary"
          disabled={mutation.isPending}
          onClick={ui.close}
        >
          {say("Cancel", "Cancelar")}
        </button>
        <button
          type="button"
          className="button primary"
          disabled={mutation.isPending || !validReport(reason, description)}
          onClick={() =>
            mutation.mutate(
              { userId, reason, description },
              {
                onSuccess: () => {
                  ui.notify(
                    say(
                      "Report submitted. Thanks for helping keep SilverChat safe.",
                      "Reporte enviado. Gracias por ayudar a mantener SilverChat seguro.",
                    ),
                  );
                  ui.close();
                },
              },
            )
          }
        >
          {say("Submit report", "Enviar reporte")}
        </button>
      </div>
    </Modal>
  );
}
