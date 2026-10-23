import { ArrowDown } from "lucide-react";
import { useMessageText } from "../i18n";
export function ScrollToBottomButton({ count, onClick }: { count: number; onClick: () => void }) {
  const { say } = useMessageText();
  return (
    <button
      className="message-scroll-bottom"
      type="button"
      onClick={onClick}
      aria-label={say("Scroll to latest messages", "Ir a los últimos mensajes")}
    >
      <ArrowDown />
      {count > 0 && <span>{count > 99 ? "99+" : count}</span>}
    </button>
  );
}
