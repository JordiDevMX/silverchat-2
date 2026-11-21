import { useState } from "react";
import { useMessageText } from "@/features/messages/i18n";
import { useChatUIStore } from "../stores/uiStore";
import { useClearChat } from "./useClearChat";
import {
  type ReportReason,
  type ReportSubmissionResult,
  type ReportTarget,
  useSubmitReport,
} from "./useReportUser";
export function useClearChatDialog(chatId: string) {
  const { say } = useMessageText();
  const ui = useChatUIStore();
  const mutation = useClearChat(chatId);
  const submit = () =>
    mutation.mutate(undefined, {
      onSuccess: () => {
        ui.notify(say("Chat cleared", "Chat vaciado"), null, { tone: "success" });
        ui.close();
      },
    });
  return { say, ui, mutation, submit };
}
function formatReportNotice(
  say: (en: string, es: string) => string,
  { blocked, blockFailed, unfollowed, unfollowFailed }: ReportSubmissionResult,
) {
  if (blocked && unfollowed) {
    return say(
      "Report submitted, channel unfollowed, and user blocked.",
      "Reporte enviado, dejaste de seguir el canal y usuario bloqueado.",
    );
  }
  if (blocked && unfollowFailed) {
    return say(
      "Report submitted and user blocked, but unfollowing the channel failed.",
      "Reporte enviado y usuario bloqueado, pero no se pudo dejar de seguir el canal.",
    );
  }
  if (blocked) {
    return say("Report submitted and user blocked.", "Reporte enviado y usuario bloqueado.");
  }
  if (unfollowed && blockFailed) {
    return say(
      "Report submitted and channel unfollowed, but blocking failed. You can block them from Privacy settings.",
      "Reporte enviado y dejaste de seguir el canal, pero no se pudo bloquear. Puedes hacerlo en Privacidad.",
    );
  }
  if (blockFailed) {
    return say(
      "Report submitted, but blocking failed. You can block them from Privacy settings.",
      "Reporte enviado, pero no se pudo bloquear. Puedes hacerlo en Privacidad.",
    );
  }
  if (unfollowed) {
    return say(
      "Report submitted and channel unfollowed.",
      "Reporte enviado y dejaste de seguir el canal.",
    );
  }
  if (unfollowFailed) {
    return say(
      "Report submitted, but unfollowing the channel failed.",
      "Reporte enviado, pero no se pudo dejar de seguir el canal.",
    );
  }
  return say(
    "Report submitted. Thanks for helping keep SilverChat safe.",
    "Reporte enviado. Gracias por ayudar a mantener SilverChat seguro.",
  );
}
export function useReportDialog(target: ReportTarget, onClose: () => void) {
  const { say } = useMessageText();
  const ui = useChatUIStore();
  const mutation = useSubmitReport();
  const [reason, setReason] = useState<ReportReason>("spam");
  const [description, setDescription] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [alsoUnfollow, setAlsoUnfollow] = useState(false);

  const submit = () => {
    if (mutation.isPending) return;
    mutation.mutate(
      { target, reason, description, alsoBlock, alsoUnfollow },
      {
        onSuccess: (result) => {
          const hasFailure = result.blockFailed || result.unfollowFailed;
          ui.notify(formatReportNotice(say, result), null, {
            tone: hasFailure ? "warning" : "success",
          });
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
    alsoUnfollow,
    setAlsoUnfollow,
    submit,
  };
}
