import { lazy, Suspense, useState } from "react";
import { QuickReactions } from "@/components/ui/messaging";
import { Modal } from "@/features/auth/components";
import { useMessageText } from "../i18n";

const EmojiPanel = lazy(() => import("./EmojiPanel"));
export function ReactionsPicker({
  onSelect,
  onClose,
  busy,
  mine,
  limited = false,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  busy: boolean;
  mine?: string;
  limited?: boolean;
}) {
  const { say } = useMessageText();
  const [all, setAll] = useState(false);
  return (
    <Modal
      className="messaging-dialog"
      title={say("React to message", "Reaccionar al mensaje")}
      onClose={onClose}
    >
      <QuickReactions
        busy={busy}
        mine={mine}
        onSelect={onSelect}
        onMore={limited ? undefined : () => setAll(!all)}
        moreLabel={say("More emoji", "Más emojis")}
      />
      {all && !limited && !busy && (
        <Suspense fallback={<p>{say("Loading…", "Cargando…")}</p>}>
          <EmojiPanel onSelect={onSelect} />
        </Suspense>
      )}
    </Modal>
  );
}
