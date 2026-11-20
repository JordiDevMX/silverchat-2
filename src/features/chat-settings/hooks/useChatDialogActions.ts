import { useState } from "react";
import { useMessageText } from "@/features/messages/i18n";
import { useChatUIStore } from "../stores/uiStore";
import { useClearChat } from "./useClearChat";
import { type ReportReason, type ReportTarget, useSubmitReport } from "./useReportUser";
export function useClearChatDialog(chatId: string) {
  const { say } = useMessageText();
  const ui = useChatUIStore();
  const mutation = useClearChat(chatId);
  const submit = () =>
    mutation.mutate(undefined, {
      onSuccess: () => {
        ui.notify(say("Chat cleared", "Chat vaciado"));
        ui.close();
      },
    });
  return { say, ui, mutation, submit };
}
export function useReportDialog(target: ReportTarget, onClose: () => void) {
  const { say } = useMessageText();
  const ui = useChatUIStore();
  const mutation = useSubmitReport();
  const [reason, setReason] = useState<ReportReason>("spam");
  const [description, setDescription] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);

  const submit = () => {
    if (mutation.isPending) return;
    mutation.mutate(
      { target, reason, description, alsoBlock },
      {
        onSuccess: ({ blocked, blockFailed }) => {
          if (blocked) {
            ui.notify(
              say(
                "Report submitted and user blocked.",
                "Reporte enviado y usuario bloqueado.",
              ),
            );
          } else if (blockFailed) {
            ui.notify(
              say(
                "Report submitted, but blocking failed. You can block them from Privacy settings.",
                "Reporte enviado, pero no se pudo bloquear. Puedes hacerlo en Privacidad.",
              ),
            );
          } else {
            ui.notify(
              say(
                "Report submitted. Thanks for helping keep SilverChat safe.",
                "Reporte enviado. Gracias por ayudar a mantener SilverChat seguro.",
              ),
            );
          }
          onClose();
        },
      },
    );
  };
  return {
    say,
    mutation,
    reason,
    setReason,
    description,
    setDescription,
    alsoBlock,
    setAlsoBlock,
    submit,
  };
}
