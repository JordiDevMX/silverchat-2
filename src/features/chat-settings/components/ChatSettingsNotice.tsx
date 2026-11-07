import { Button } from "@/components/ui/button";
import { useMessageText } from "@/features/messages/i18n";
import { useChatUIStore } from "../stores/uiStore";
export function ChatSettingsNotice() {
  const notice = useChatUIStore((s) => s.notice);
  const notify = useChatUIStore((s) => s.notify);
  const { say } = useMessageText();
  return notice ? (
    <div className="chat-settings-notice chat-settings-notice-v2" role="status">
      {notice}
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label={say("Dismiss", "Cerrar")}
        onClick={() => notify("")}
      >
        ×
      </Button>
    </div>
  ) : null;
}
