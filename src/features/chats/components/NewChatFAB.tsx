import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { useNewChatActions } from "../hooks/useNewChatActions";
import { useChatText } from "../i18n";
import { NewChatDialogSurface } from "./NewChatDialogSurface";
export function NewChatFAB({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const t = useChatText();
  const { action, go, createSelf } = useNewChatActions(onClose);
  return (
    <>
      <FloatingActionButton
        kind="chats"
        className="new-chat-fab"
        aria-label={t("New chat")}
        onClick={onOpen}
      />
      {open && (
        <NewChatDialogSurface
          t={t}
          busy={action.busy}
          feedback={action.feedback}
          go={go}
          createSelf={() => void createSelf()}
          onClose={onClose}
        />
      )}
    </>
  );
}
