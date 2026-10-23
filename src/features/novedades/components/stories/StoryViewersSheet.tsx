import { Modal } from "@/features/auth/components";
import { useMessageText } from "@/features/messages/i18n";
import { Avatar, QueryState } from "@/features/settings/components/shared";
import { useStoryViewers } from "../../hooks/stories/useStoryViewers";
export function StoryViewersSheet({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const q = useStoryViewers(storyId);
  const { say, language } = useMessageText();
  return (
    <Modal
      title={say(`Viewed by ${q.data?.length ?? 0}`, `Visto por ${q.data?.length ?? 0}`)}
      className="story-viewers-sheet"
      onClose={onClose}
    >
      <QueryState loading={q.isPending} error={q.error} retry={() => void q.refetch()} />
      {q.data?.map((p) => (
        <div className="story-viewer-person" key={p.viewer_id}>
          <Avatar profile={{ ...p, id: p.viewer_id }} size="small" />
          <span>
            <strong>{p.display_name}</strong>
            <small>
              @{p.username} ·{" "}
              {new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(
                -Math.max(0, Math.floor((Date.now() - Date.parse(p.viewed_at)) / 60000)),
                "minute",
              )}
            </small>
          </span>
        </div>
      ))}
      {q.data?.length === 0 && <p>{say("No views yet", "Aún no hay vistas")}</p>}
      <button type="button" className="button secondary" onClick={onClose}>
        {say("Close", "Cerrar")}
      </button>
    </Modal>
  );
}
