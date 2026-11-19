import { ChevronLeft, ChevronRight, Eye, MoreHorizontal, Pause, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StoryOverlay } from "@/components/ui/story-overlay";
import { useMessageText } from "@/features/messages/i18n";
import { Avatar } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { useDeleteStory } from "../../hooks/stories/useDeleteStory";
import { useMarkStoryViewed } from "../../hooks/stories/useMarkStoryViewed";
import { useStories } from "../../hooks/stories/useStories";
import { useStoryNavigation } from "../../hooks/stories/useStoryNavigation";
import { useStoryTimer } from "../../hooks/stories/useStoryTimer";
import { useStoryViewers } from "../../hooks/stories/useStoryViewers";
import { orderStoryGroups } from "../../lib/storyOrdering";
import {
  buildStoryTimeline,
  resolveCursorAfterTimelineChange,
  resolveInitialCursor,
  type StoryEntry,
} from "../../lib/storyTimeline";
import { type SlidePlaybackReport, StoryCubeSlide } from "./StoryCubeSlide";
import { StoryProgressBar } from "./StoryProgressBar";
import { StoryReplyInput } from "./StoryReplyInput";
import { StoryViewersSheet } from "./StoryViewersSheet";

const EMPTY_USER_IDS: string[] = [];

function ViewerStage({
  timeline,
  initialIndex,
  onClose,
  closing,
}: {
  timeline: StoryEntry[];
  initialIndex: number;
  onClose: () => void;
  closing: boolean;
}) {
  const { user } = useAuth();
  const { say, language } = useMessageText();
  const [reply, setReply] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [playbackById, setPlaybackById] = useState<Record<string, SlidePlaybackReport>>({});

  const gesturesDisabled = closing || sheet || confirm || menu;
  const nav = useStoryNavigation({
    totalCount: timeline.length,
    initialIndex,
    disabled: gesturesDisabled,
    onReachEnd: onClose,
    onClose,
  });

  const activeEntry = timeline[nav.activeIndex] ?? null;
  const story = activeEntry?.story ?? null;
  const activeStoryId = story?.id ?? null;
  const mine = story ? story.user_id === user?.id : false;

  // Keep cursor anchored to the same story ID only when live query data updates (e.g. expiry).
  const currentStoryIdRef = useRef<string | null>(activeStoryId);
  const lastTimelineRef = useRef<StoryEntry[]>(timeline);
  useEffect(() => {
    if (timeline !== lastTimelineRef.current) {
      lastTimelineRef.current = timeline;
      if (timeline.length) {
        const reconciled = resolveCursorAfterTimelineChange(
          timeline,
          currentStoryIdRef.current,
          Math.max(0, nav.activeIndex),
        );
        if (reconciled >= 0 && reconciled !== nav.activeIndex) {
          nav.syncIndex(reconciled);
          currentStoryIdRef.current = timeline[reconciled]?.story.id ?? null;
          return;
        }
      }
    }
    currentStoryIdRef.current = activeStoryId;
  }, [timeline, activeStoryId, nav.activeIndex, nav.syncIndex]);

  // Reset per-story overlay UI when switching stories.
  const prevStoryIdRef = useRef<string | null>(activeStoryId);
  useEffect(() => {
    if (prevStoryIdRef.current !== activeStoryId) {
      prevStoryIdRef.current = activeStoryId;
      setReply(false);
      setMenu(false);
      setSheet(false);
      setConfirm(false);
    }
  }, [activeStoryId]);

  useEffect(() => {
    const fn = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", fn);
    return () => document.removeEventListener("visibilitychange", fn);
  }, []);

  // Route keyboard navigation through the unified transition engine.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (closing || sheet || confirm || menu || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        nav.navigate(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        nav.navigate(-1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closing, sheet, confirm, menu, nav.navigate]);

  const mark = useMarkStoryViewed();
  const views = useStoryViewers(story?.id ?? "", mine && !!story);
  const remove = useDeleteStory();

  useEffect(() => {
    if (!story || mine || closing || nav.isDragging) return;
    // Delay the view mark so fast swipes past a story cancel it before firing.
    const timer = setTimeout(() => mark.mutate(story.id), 500);
    return () => clearTimeout(timer);
  }, [story, mine, mark.mutate, closing, nav.isDragging]);

  const handlePlaybackChange = useCallback((storyId: string, report: SlidePlaybackReport) => {
    setPlaybackById((prev) => {
      const existing = prev[storyId];
      if (
        existing &&
        existing.buffering === report.buffering &&
        existing.playBlocked === report.playBlocked &&
        existing.duration === report.duration
      ) {
        return prev;
      }
      return { ...prev, [storyId]: report };
    });
  }, []);

  // Guard against double auto-advance when both timer and video onEnded fire for the same visit.
  const visitKey = `${activeStoryId ?? "none"}:${nav.activeIndex}`;
  const visitTrackerRef = useRef({ key: visitKey, seq: 0 });
  if (visitTrackerRef.current.key !== visitKey) {
    visitTrackerRef.current = { key: visitKey, seq: visitTrackerRef.current.seq + 1 };
  }
  const visitToken = `${visitKey}:${visitTrackerRef.current.seq}`;
  const autoAdvancedVisitRef = useRef<string | null>(null);
  const advanceOnce = useCallback(() => {
    if (closing || !activeStoryId) return;
    if (autoAdvancedVisitRef.current === visitToken) return;
    autoAdvancedVisitRef.current = visitToken;
    nav.navigate(1);
  }, [closing, activeStoryId, visitToken, nav.navigate]);

  const handleVideoEnded = useCallback(
    (storyId: string) => {
      if (storyId === activeStoryId) {
        advanceOnce();
      }
    },
    [activeStoryId, advanceOnce],
  );

  const slideState: SlidePlaybackReport = (activeStoryId
    ? playbackById[activeStoryId]
    : undefined) ?? {
    buffering: story ? story.media_type !== "text" : false,
    playBlocked: false,
    duration: 15000,
  };

  const mediaPaused = closing || nav.isPressed || reply || sheet || menu || confirm || hidden;
  const timerPaused =
    mediaPaused || nav.isSettling || slideState.buffering || slideState.playBlocked || !story;
  const progress = useStoryTimer(
    story?.media_type === "video" ? slideState.duration : 5000,
    advanceOnce,
    timerPaused,
    visitToken,
  );

  if (!story || !activeEntry) {
    return (
      <>
        <p>{say("This story is no longer available.", "Esta historia ya no está disponible.")}</p>
        <button type="button" onClick={onClose}>
          {say("Close", "Cerrar")}
        </button>
      </>
    );
  }

  return (
    <div
      className="story-viewer-shell"
      data-chrome-hidden={nav.chromeHidden ? "true" : "false"}
      data-reduced-motion={nav.reducedMotion ? "true" : "false"}
    >
      <div className="story-chrome">
        <StoryProgressBar
          count={activeEntry.groupCount}
          index={activeEntry.indexInGroup}
          progress={progress}
        />
      </div>
      <header className="story-viewer-header story-chrome">
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
        <span className="story-pause-indicator" data-paused={timerPaused} aria-hidden="true">
          <Pause size={12} />
          {say("Paused", "En pausa")}
        </span>
        {mine && (
          <button
            type="button"
            aria-label={say("Story options", "Opciones de historia")}
            onClick={() => setMenu(!menu)}
          >
            <MoreHorizontal size={20} />
          </button>
        )}
        <button type="button" aria-label={say("Close story", "Cerrar historia")} onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      {menu && (
        <button
          type="button"
          className="story-delete-action"
          onClick={() => {
            setMenu(false);
            setConfirm(true);
          }}
        >
          {say("Delete story", "Eliminar historia")}
        </button>
      )}
      <div
        ref={nav.setViewportRef}
        className="story-cube-viewport"
        data-dragging={nav.isDragging ? "true" : "false"}
        data-holding={nav.isHolding ? "true" : "false"}
        data-settling={nav.isSettling ? "true" : "false"}
        {...nav.gestureHandlers}
      >
        <div className="story-cube-stage-3d">
          {nav.visibleIndices.map((idx) => {
            const item = timeline[idx];
            if (!item) return null;
            return (
              <StoryCubeSlide
                key={item.story.id}
                story={item.story}
                index={idx}
                isActive={idx === nav.activeIndex}
                paused={mediaPaused}
                registerFace={nav.registerFace}
                onPlaybackChange={handlePlaybackChange}
                onVideoEnded={handleVideoEnded}
              />
            );
          })}
        </div>
      </div>
      {story.caption && <p className="story-caption story-chrome">{story.caption}</p>}
      <nav className="story-controls story-chrome">
        <button type="button" onClick={() => nav.navigate(-1)}>
          <ChevronLeft size={16} />
          {say("Previous", "Anterior")}
        </button>
        <button type="button" onClick={() => nav.navigate(1)}>
          {say("Next", "Siguiente")}
          <ChevronRight size={16} />
        </button>
      </nav>
      <footer className="story-chrome">
        {mine ? (
          <button type="button" className="story-owner-views" onClick={() => setSheet(true)}>
            <Eye size={16} /> {views.data?.length ?? 0} {say("views", "vistas")}
          </button>
        ) : (
          <StoryReplyInput key={story.id} story={story} onFocusChange={setReply} />
        )}
      </footer>
      {sheet && <StoryViewersSheet storyId={story.id} onClose={() => setSheet(false)} />}
      {confirm && (
        <StoryOverlay
          title={say("Delete this story?", "¿Eliminar esta historia?")}
          onClose={() => setConfirm(false)}
          canClose={!remove.isPending}
          className="story-confirm"
        >
          {(closeConfirm) => (
            <>
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
                <Button
                  type="button"
                  disabled={remove.isPending}
                  variant="outline"
                  onClick={closeConfirm}
                >
                  {say("Cancel", "Cancelar")}
                </Button>
                <Button
                  type="button"
                  disabled={remove.isPending}
                  variant="destructive"
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
                </Button>
              </div>
            </>
          )}
        </StoryOverlay>
      )}
    </div>
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
  const ordered = useRef<string[] | null>(null);
  if (!ordered.current && q.data) {
    const o = orderStoryGroups(q.data, user?.id ?? "");
    ordered.current = [...(o.mine ? [o.mine] : []), ...o.unwatched, ...o.watched].map(
      (g) => g.user_id,
    );
  }
  const orderedIds = ordered.current ?? EMPTY_USER_IDS;
  const timeline = useMemo(() => buildStoryTimeline(q.data, orderedIds), [q.data, orderedIds]);
  const initialIndex = useMemo(
    () => resolveInitialCursor(timeline, userId, initialStoryIndex),
    [timeline, userId, initialStoryIndex],
  );

  return (
    <StoryOverlay title={say("Story", "Historia")} className="story-viewer" onClose={onClose}>
      {(close, closing) => (
        <ViewerStage
          timeline={timeline}
          initialIndex={initialIndex}
          onClose={close}
          closing={closing}
        />
      )}
    </StoryOverlay>
  );
}
