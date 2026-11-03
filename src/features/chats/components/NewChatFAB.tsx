import { Bookmark, MessageSquarePlus, Plus, Radio, Users } from "lucide-react";
import { Modal } from "@/features/auth/components";
import { useNewChatActions } from "../hooks/useNewChatActions";
import { useChatText } from "../i18n";
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
      <button type="button" className="new-chat-fab" aria-label={t("New chat")} onClick={onOpen}>
        <Plus size={26} />
      </button>
      {open && (
        <Modal
          className="new-chat-dialog"
          title={t("New chat")}
          onClose={action.busy ? undefined : onClose}
        >
          <div className="new-chat-menu">
            {(
              [
                [MessageSquarePlus, "New chat", "/chats/new"],
                [Users, "New group", "/chats/new-group"],
                [Radio, "New channel", "/channels/new"],
              ] as const
            ).map(([Icon, label, href]) => (
              <button
                className="button secondary"
                disabled={action.busy}
                type="button"
                key={href}
                onClick={() => go(href)}
              >
                <Icon size={20} />
                {t(label)}
              </button>
            ))}
            <button
              type="button"
              className="button secondary"
              disabled={action.busy}
              onClick={() => void createSelf()}
            >
              <Bookmark size={20} />
              {t("Message yourself")}
            </button>
            {action.feedback}
            <button
              className="button secondary"
              type="button"
              disabled={action.busy}
              onClick={onClose}
            >
              {t("Cancel")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
