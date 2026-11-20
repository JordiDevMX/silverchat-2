import { useEffect, useRef, useState } from "react";
import { useMessageText } from "@/features/messages/i18n";
import { useMediaUrl } from "@/features/messages/lib/media";
import { safeStoryColor } from "../../lib/storyColors";
import type { Story } from "../../types";

export type SlidePlaybackReport = {
  buffering: boolean;
  playBlocked: boolean;
  duration: number;
};

/**
 * Renders a single story face inside the 3D cube carousel.
 * Keyed by `story.id` and keeps a stable element type across active/inactive
 * states so adjacent media stays preloaded and NEVER remounts on transition.
 */
export function StoryCubeSlide({
  story,
  index,
  isActive,
  paused,
  registerFace,
  onPlaybackChange,
  onVideoEnded,
}: {
  story: Story;
  index: number;
  isActive: boolean;
  paused: boolean;
  registerFace: (index: number, face: HTMLElement | null, shade: HTMLElement | null) => void;
  onPlaybackChange: (storyId: string, report: SlidePlaybackReport) => void;
  onVideoEnded: (storyId: string) => void;
}) {
  const { say } = useMessageText();
  const url = useMediaUrl(story.upload);
  const faceRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const endedForActiveRef = useRef(false);
  const wasActiveRef = useRef(isActive);

  const [buffering, setBuffering] = useState(story.media_type !== "text");
  const [playBlocked, setPlayBlocked] = useState(false);
  const [duration, setDuration] = useState(15000);
  const [failed, setFailed] = useState(false);

  // Register DOM refs with the 60fps cube transform driver.
  useEffect(() => {
    const face = faceRef.current;
    registerFace(index, face, shadeRef.current);
    return () => registerFace(index, null, null);
  }, [index, registerFace]);

  // Reset per-visit state when this slide becomes active (rewind only on fresh entry,
  // never while spinning out so the outgoing frame stays frozen smoothly).
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      endedForActiveRef.current = false;
      const v = videoRef.current;
      if (v && v.currentTime > 0) {
        try {
          v.currentTime = 0;
        } catch {
          // Ignore seek errors if metadata has not loaded yet.
        }
      }
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  // Report slide's playback readiness/duration (including while preloading) so promoting
  // an adjacent slide to active starts immediately with zero buffering flash.
  useEffect(() => {
    onPlaybackChange(story.id, { buffering, playBlocked, duration });
  }, [story.id, buffering, playBlocked, duration, onPlaybackChange]);

  // Handle video playback without remounting: preloaded inactive slides stay muted & paused,
  // active slides play smoothly and pause on hold/modal.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !url.data) return;
    if (!isActive) {
      v.pause();
      v.muted = true;
      return;
    }
    v.muted = false;
    if (paused) {
      v.pause();
    } else if (!playBlocked) {
      if (v.ended || v.currentTime >= 15) {
        v.currentTime = 0;
      }
      void v.play().catch(() => setPlayBlocked(true));
    }
  }, [isActive, paused, playBlocked, url.data]);

  const triggerVideoEnded = () => {
    if (!isActive || endedForActiveRef.current) return;
    endedForActiveRef.current = true;
    onVideoEnded(story.id);
  };

  const background =
    story.media_type === "text" ? safeStoryColor(story.background_color) : undefined;

  return (
    <div
      ref={faceRef}
      className="story-cube-face"
      data-story-index={index}
      data-story-id={story.id}
      data-story-active={isActive ? "true" : "false"}
      aria-hidden={isActive ? undefined : true}
      inert={isActive ? undefined : true}
    >
      <div
        className={isActive ? "story-stage story-cube-face-surface" : "story-cube-face-surface"}
        style={{ background }}
      >
        {story.media_type === "text" ? (
          <p className="story-text">{story.text_content}</p>
        ) : url.data ? (
          story.media_type === "image" ? (
            <img
              draggable={false}
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
              ref={videoRef}
              src={url.data}
              muted={!isActive}
              playsInline
              preload="auto"
              onLoadedMetadata={(e) => {
                const videoDuration = Math.min(15000, e.currentTarget.duration * 1000) || 15000;
                setDuration(videoDuration);
              }}
              onCanPlay={() => {
                if (!isActive) setBuffering(false);
              }}
              onPlaying={() => {
                setBuffering(false);
                setPlayBlocked(false);
              }}
              onWaiting={() => {
                if (isActive) setBuffering(true);
              }}
              onEnded={triggerVideoEnded}
              onTimeUpdate={(e) => {
                if (isActive && e.currentTarget.currentTime >= 15) {
                  e.currentTarget.pause();
                  triggerVideoEnded();
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
        {isActive && playBlocked && (
          <button
            type="button"
            className="story-play"
            onClick={() => {
              void videoRef.current
                ?.play()
                .then(() => setPlayBlocked(false))
                .catch(() => setPlayBlocked(true));
            }}
          >
            {say("Play video", "Reproducir video")}
          </button>
        )}
      </div>
      <div ref={shadeRef} className="story-cube-shade" aria-hidden="true" />
    </div>
  );
}
