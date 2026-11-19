import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { reactionNotificationStore } from "@/features/chats/utils/reactionNotifications";
import { useMessageText } from "@/features/messages/i18n";
import { useChatUIStore } from "../stores/uiStore";
export function ChatSettingsNotice() {
  const notice = useChatUIStore((s) => s.notice);
  const noticeAction = useChatUIStore((s) => s.noticeAction);
  const notify = useChatUIStore((s) => s.notify);
  const router = useRouter();
  const { say } = useMessageText();
  const dismiss = () => {
    if (noticeAction?.kind === "reaction") {
      reactionNotificationStore.getState().setActiveToast(null, null);
    }
    notify("");
  };
  return notice ? (
    <div
      className="chat-settings-notice chat-settings-notice-v2"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {noticeAction ? (
        <button
          type="button"
          className="chat-notice-link"
          onClick={() => {
            const action = noticeAction;
            dismiss();
            reactionNotificationStore.getState().requestNavigation(action.chatId, action.messageId);
            void router.navigate({ href: action.href });
          }}
        >
          {notice}
        </button>
      ) : (
        <span>{notice}</span>
      )}
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label={say("Dismiss", "Cerrar")}
        onClick={dismiss}
      >
        ×
      </Button>
    </div>
  ) : null;
}
