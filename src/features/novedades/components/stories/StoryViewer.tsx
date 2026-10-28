import { useEffect, useRef, useState } from "react";
import { Modal } from "@/features/auth/components";
import { useMessageText } from "@/features/messages/i18n";
import { useMediaUrl } from "@/features/messages/lib/media";
import { Avatar } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { useDeleteStory } from "../../hooks/stories/useDeleteStory";
import { useMarkStoryViewed } from "../../hooks/stories/useMarkStoryViewed";
import { useStories } from "../../hooks/stories/useStories";
import { useStoryTimer } from "../../hooks/stories/useStoryTimer";
import { useStoryViewers } from "../../hooks/stories/useStoryViewers";
import { safeStoryColor } from "../../lib/storyColors";
import { orderStoryGroups } from "../../lib/storyOrdering";
import type { Story } from "../../types";
import { StoryProgressBar } from "./StoryProgressBar";
import { StoryReplyInput } from "./StoryReplyInput";
import { StoryViewersSheet } from "./StoryViewersSheet";

function Segment({
  story,
  index,
  count,
  onNext,
  onPrevious,
  onClose,
}: {
  story: Story;
  index: number;
  count: number;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { say, language } = useMessageText();
  const mine = story.user_id === user?.id;
  const url = useMediaUrl(story.upload);
  const video = useRef<HTMLVideoElement>(null);
  const [held, setHeld] = useState(false);
  const [reply, setReply] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [buffering, setBuffering] = useState(story.media_type !== "text");
  const [playBlocked, setPlayBlocked] = useState(false);
  const [duration, setDuration] = useState(15000);
  const [failed, setFailed] = useState(false);
  const advanced = useRef(false);
  const next = () => {
    if (!advanced.current) {
      advanced.current = true;
      onNext();
    }
  };
  const mark = useMarkStoryViewed();
  const views = useStoryViewers(story.id, mine);
  const remove = useDeleteStory();
  const gesture = useRef<{ x: number; y: number; at: number } | undefined>(undefined);
  useEffect(() => {
    if (mine) return;
    // Delay the view mark so fast swipes past a story cancel it before firing.
    const timer = setTimeout(() => mark.mutate(story.id), 500);
    return () => clearTimeout(timer);
  }, [story.id, mine, mark.mutate]);
  useEffect(() => {
    const fn = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", fn);
    return () => document.removeEventListener("visibilitychange", fn);
  }, []);
  const paused = held || reply || sheet || menu || confirm || hidden || buffering || playBlocked;
  const progress = useStoryTimer(story.media_type === "video" ? duration : 5000, next, paused);
  useEffect(() => {
    const v = video.current;
    if (!v || !url.data) return;
    if (held || reply || sheet || menu || confirm || hidden) v.pause();
    else if (!playBlocked) void v.play().catch(() => setPlayBlocked(true));
  }, [held, reply, sheet, menu, confirm, hidden, playBlocked, url.data]);
  return (
    <>
      <StoryProgressBar count={count} index={index} progress={progress} />
      <header className="story-viewer-header">
        <Avatar profile={story.profile ?? { id: story.user_id }} size="small" />
        <span>
          <strong>{story.profile?.display_name}</strong>
          <small>
            {new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(
              -Math.max(0, Math.floor((Date.now() - Date.parse(story.created_at)) / 3600000)),
              "hour",
            )}
          </small>
        </span>
        {mine && (
          <button
            type="button"
            aria-label={say("Story options", "Opciones de historia")}
            onClick={() => setMenu(!menu)}
          >
            ⋮
          </button>
        )}
        <button type="button" aria-label={say("Close story", "Cerrar historia")} onClick={onClose}>
          ×
        </button>
      </header>
      {menu && (
        <button
          type="button"
          className="button danger"
          onClick={() => {
            setMenu(false);
            setConfirm(true);
          }}
        >
          {say("Delete story", "Eliminar historia")}
        </button>
      )}
      <div
        className="story-stage"
        style={{
          background:
            story.media_type === "text" ? safeStoryColor(story.background_color) : undefined,
        }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          gesture.current = { x: e.clientX, y: e.clientY, at: performance.now() };
          setHeld(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          gesture.current = undefined;
          setHeld(false);
          if (!g) return;
          const dy = e.clientY - g.y;
          if (dy > 80 && Math.abs(e.clientX - g.x) < 100) {
            onClose();
            return;
          }
          if (performance.now() - g.at < 250 && Math.hypot(e.clientX - g.x, dy) < 15) {
            const rect = e.currentTarget.getBoundingClientRect();
            if (e.clientX - rect.left < rect.width * 0.3) onPrevious();
            else next();
          }
        }}
        onPointerCancel={() => {
          setHeld(false);
          gesture.current = undefined;
        }}
      >
        {story.media_type === "text" ? (
          <p className="story-text">{story.text_content}</p>
        ) : url.data ? (
          story.media_type === "image" ? (
            <img
              src={url.data}
              alt={story.caption ?? say("Story", "Historia")}
              onLoad={() => setBuffering(false)}
              onError={() => {
                setFailed(true);
                setBuffering(false);
              }}
            />
          ) : (
            <video
              ref={video}
              src={url.data}
              autoPlay
              playsInline
              onLoadedMetadata={(e) =>
                setDuration(Math.min(15000, e.currentTarget.duration * 1000) || 15000)
              }
              onPlaying={() => {
                setBuffering(false);
                setPlayBlocked(false);
              }}
              onWaiting={() => setBuffering(true)}
              onEnded={next}
              onTimeUpdate={(e) => {
                if (e.currentTarget.currentTime >= 15) {
                  e.currentTarget.pause();
                  next();
                }
              }}
              onError={() => {
                setFailed(true);
                setBuffering(false);
              }}
            >
              <track kind="captions" />
            </video>
          )
        ) : (
          <p>
            {url.isError
              ? say("Media unavailable", "Contenido no disponible")
              : say("Loading…", "Cargando…")}
          </p>
        )}
        {failed && <p role="alert">{say("Media unavailable", "Contenido no disponible")}</p>}
        {playBlocked && (
          <button
            type="button"
            className="story-play"
            onClick={() => {
              void video.current
                ?.play()
                .then(() => setPlayBlocked(false))
                .catch(() => setPlayBlocked(true));
            }}
          >
            {say("Play video", "Reproducir video")}
          </button>
        )}
      </div>
      {story.caption && <p className="story-caption">{story.caption}</p>}
      <nav className="story-controls">
        <button type="button" onClick={onPrevious}>
          {say("Previous", "Anterior")}
        </button>
        <button type="button" onClick={next}>
          {say("Next", "Siguiente")}
        </button>
      </nav>
      <footer>
        {mine ? (
          <button type="button" className="story-owner-views" onClick={() => setSheet(true)}>
            👁 {views.data?.length ?? 0} {say("views", "vistas")}
          </button>
        ) : (
          <StoryReplyInput story={story} onFocusChange={setReply} />
        )}
      </footer>
      {sheet && <StoryViewersSheet storyId={story.id} onClose={() => setSheet(false)} />}{" "}
      {confirm && (
        <Modal
          title={say("Delete this story?", "¿Eliminar esta historia?")}
          onClose={remove.isPending ? undefined : () => setConfirm(false)}
        >
          <p>
            {say(
              "This permanently removes your story.",
              "Tu historia se eliminará permanentemente.",
            )}
          </p>
          {remove.isError && (
            <p role="alert">
              {say("Unable to delete. Try again.", "No se pudo eliminar. Reinténtalo.")}
            </p>
          )}
          <div className="modal-actions">
            <button type="button" disabled={remove.isPending} onClick={() => setConfirm(false)}>
              {say("Cancel", "Cancelar")}
            </button>
            <button
              type="button"
              disabled={remove.isPending}
              onClick={async () => {
                try {
                  await remove.mutateAsync(story);
                  onClose();
                } catch {
                  /* The mutation renders its error and remains retryable. */
                }
              }}
            >
              {say("Delete story", "Eliminar historia")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function StoryViewer({
  userId,
  initialStoryIndex = 0,
  onClose,
}: {
  userId: string;
  initialStoryIndex?: number;
  onClose: () => void;
}) {
  const q = useStories();
  const { user } = useAuth();
  const { say } = useMessageText();
  const [active, setActive] = useState(userId);
  const [index, setIndex] = useState(initialStoryIndex);
  const ordered = useRef<string[] | null>(null);
  if (!ordered.current && q.data) {
    const o = orderStoryGroups(q.data, user?.id ?? "");
    ordered.current = [...(o.mine ? [o.mine] : []), ...o.unwatched, ...o.watched].map(
      (g) => g.user_id,
    );
  }
  const group = q.data?.find((g) => g.user_id === active);
  const stories = group?.stories.filter((s) => Date.parse(s.expires_at) > Date.now()) ?? [];
  const story = stories[index];
  const move = (delta: number) => {
    const nextIndex = index + delta;
    if (nextIndex >= 0 && nextIndex < stories.length) {
      setIndex(nextIndex);
      return;
    }
    const ids = ordered.current ?? [];
    const nextUser = ids[ids.indexOf(active) + delta];
    if (!nextUser) {
      if (delta > 0) onClose();
      return;
    }
    setActive(nextUser);
    setIndex(
      delta > 0
        ? 0
        : Math.max(0, (q.data?.find((g) => g.user_id === nextUser)?.stories.length ?? 1) - 1),
    );
  };
  return (
    <Modal title={say("Story", "Historia")} className="story-viewer" onClose={onClose}>
      {story ? (
        <Segment
          key={story.id}
          story={story}
          index={index}
          count={stories.length}
          onNext={() => move(1)}
          onPrevious={() => move(-1)}
          onClose={onClose}
        />
      ) : (
        <>
          <p>{say("This story is no longer available.", "Esta historia ya no está disponible.")}</p>
          <button type="button" onClick={onClose}>
            {say("Close", "Cerrar")}
          </button>
        </>
      )}
    </Modal>
  );
}
