import { useMessageText } from "@/features/messages/i18n";
import { useChatUIStore } from "../stores/uiStore";
export function ChatSettingsNotice() {
  const notice = useChatUIStore((s) => s.notice);
  const notify = useChatUIStore((s) => s.notify);
  const { say } = useMessageText();
  return notice ? (
    <div className="chat-settings-notice" role="status">
      {notice}
      <button type="button" aria-label={say("Dismiss", "Cerrar")} onClick={() => notify("")}>
        ×
      </button>
    </div>
  ) : null;
}
