import { lazy, Suspense, useState } from "react";
import { Modal } from "@/features/auth/components";
import { useMessageText } from "../i18n";

const EmojiPanel = lazy(() => import("./EmojiPanel"));
export function ReactionsPicker({
  onSelect,
  onClose,
  busy,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const { say } = useMessageText();
  const [all, setAll] = useState(false);
  return (
    <Modal title={say("React to message", "Reaccionar al mensaje")} onClose={onClose}>
      <div className="quick-reactions">
        {["👍", "❤️", "😂", "😮", "😢", "🙏", "🎉", "🔥"].map((emoji) => (
          <button
            type="button"
            key={emoji}
            disabled={busy}
            aria-label={emoji}
            onClick={() => onSelect(emoji)}
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          aria-label={say("More emoji", "Más emojis")}
          onClick={() => setAll(!all)}
        >
          +
        </button>
      </div>
      {all && !busy && (
        <Suspense fallback={<p>{say("Loading…", "Cargando…")}</p>}>
          <EmojiPanel onSelect={onSelect} />
        </Suspense>
      )}
    </Modal>
  );
}
