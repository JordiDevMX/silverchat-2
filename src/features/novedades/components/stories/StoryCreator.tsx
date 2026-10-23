import { useEffect, useRef, useState } from "react";
import { Modal } from "@/features/auth/components";
import { useMessageText } from "@/features/messages/i18n";
import { cleanupUploads, prepareAndUpload } from "@/features/messages/lib/upload";
import { videoThumbnail } from "@/features/messages/lib/videoThumbnail";
import type { Upload } from "@/features/messages/types";
import { useAuth } from "@/lib/auth-provider";
import { useCreateStory } from "../../hooks/stories/useCreateStory";
import { useMyStories } from "../../hooks/stories/useMyStories";
import { StoryTextEditor } from "./StoryTextEditor";
export function StoryCreator({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { say } = useMessageText();
  const create = useCreateStory();
  const mine = useMyStories();
  const [mode, setMode] = useState<"camera" | "gallery" | "text">("camera");
  const [file, setFile] = useState<File>();
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const tracked = useRef<Upload[]>([]);
  const attempted = useRef(false);
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  useEffect(
    () => () => {
      controller.current?.abort();
      if (!attempted.current) void cleanupUploads(tracked.current);
    },
    [],
  );
  const select = async (next?: File) => {
    if (!next) return;
    setError("");
    setReady(false);
    setFile(undefined);
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    try {
      if (!/^(image|video)\//.test(next.type)) throw new Error("Choose an image or video");
      if (next.size > 50 * 1024 * 1024) throw new Error("Choose a file below 50 MB");
      if (next.type.startsWith("video/")) {
        const info = await videoThumbnail(next, c.signal);
        if (info.duration > 15) throw new Error("Video must be at most 15 seconds");
      }
      c.signal.throwIfAborted();
      setFile(next);
      setReady(true);
    } catch (e) {
      if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Unable to read media");
    }
  };
  return (
    <Modal
      title={say("Create story", "Crear historia")}
      className="story-creator"
      onClose={busy ? undefined : onClose}
    >
      {mode === "text" ? (
        <StoryTextEditor
          onClose={() => setMode("camera")}
          onSaved={onClose}
          onBusyChange={setBusy}
        />
      ) : (
        <>
          <div className="story-create-preview">
            {file?.type.startsWith("video/") ? (
              <video src={url} controls playsInline>
                <track kind="captions" />
              </video>
            ) : file ? (
              <img src={url} alt={say("Story preview", "Vista previa de historia")} />
            ) : (
              <p>
                {say(
                  "Choose a photo or a video up to 15 seconds",
                  "Elige una foto o un video de hasta 15 segundos",
                )}
              </p>
            )}
          </div>
          <label className="field">
            {say("Caption", "Descripción")}
            <textarea
              value={caption}
              maxLength={500}
              disabled={busy || locked}
              onChange={(e) => setCaption(e.target.value)}
            />
          </label>
          <label className="button secondary">
            {mode === "camera"
              ? say("Open camera", "Abrir cámara")
              : say("Choose from gallery", "Elegir de galería")}
            <input
              type="file"
              accept="image/*,video/*"
              capture={mode === "camera" ? "environment" : undefined}
              disabled={busy || locked}
              onChange={(e) => void select(e.target.files?.[0])}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          {busy && (
            <progress
              aria-label={say("Upload progress", "Progreso de carga")}
              max={100}
              value={progress}
            />
          )}
          <div className="modal-actions">
            <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
              {say("Cancel", "Cancelar")}
            </button>
            <button
              type="button"
              className="button primary"
              disabled={busy || !ready || mine.data.length >= 10}
              onClick={async () => {
                if (!file) return;
                setBusy(true);
                setError("");
                const c = new AbortController();
                controller.current = c;
                try {
                  if (!tracked.current.length) {
                    const result = await prepareAndUpload(
                      file,
                      user?.id ?? "",
                      user?.id ?? "",
                      c.signal,
                      setProgress,
                      { bucket: "story-media", maxVideoSeconds: 15 },
                    );
                    tracked.current = [
                      result.upload,
                      ...(result.thumbnail ? [result.thumbnail] : []),
                    ];
                  }
                  attempted.current = true;
                  setLocked(true);
                  await create.mutateAsync({
                    p_media_type: file.type.startsWith("video/") ? "video" : "image",
                    p_file_upload_id: tracked.current[0]?.id,
                    p_thumbnail_upload_id: tracked.current[1]?.id,
                    p_caption: caption.trim() || undefined,
                  });
                  tracked.current = [];
                  onClose();
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Unable to publish story. Retry when connected.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {say("Send story", "Enviar historia")}
            </button>
          </div>
          {mine.data.length >= 10 && (
            <p role="alert">
              {say(
                "You can have up to 10 active stories",
                "Puedes tener hasta 10 historias activas",
              )}
            </p>
          )}
        </>
      )}
      <nav className="story-create-modes" aria-label={say("Story mode", "Tipo de historia")}>
        {(["camera", "gallery", "text"] as const).map((m) => (
          <button
            type="button"
            key={m}
            disabled={busy || locked}
            aria-pressed={m === mode}
            onClick={() => setMode(m)}
          >
            {m === "camera"
              ? say("Camera", "Cámara")
              : m === "gallery"
                ? say("Gallery", "Galería")
                : say("Text", "Texto")}
          </button>
        ))}
      </nav>
    </Modal>
  );
}
