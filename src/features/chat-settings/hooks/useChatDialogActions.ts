import { useState } from "react";
import { useMessageText } from "@/features/messages/i18n";
import { useChatUIStore } from "../stores/uiStore";
import { useClearChat } from "./useClearChat";
import { type ReportReason, useReportUser } from "./useReportUser";
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
export function useReportDialog(userId: string) {
  const { say } = useMessageText();
  const ui = useChatUIStore();
  const mutation = useReportUser();
  const [reason, setReason] = useState<ReportReason>("spam");
  const [description, setDescription] = useState("");

  const submit = () =>
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
    );
  return { say, ui, mutation, reason, setReason, description, setDescription, submit };
}
