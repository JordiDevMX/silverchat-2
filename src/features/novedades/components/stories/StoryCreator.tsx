import { Camera, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StoryOverlay } from "@/components/ui/story-overlay";
import { extractDataTransferMedia, formatClipboardFeedback } from "@/lib/clipboard-images";
import { useClipboardImageTarget } from "@/lib/clipboard-paste";
import { useStoryCreator } from "../../hooks/stories/useStoryCreator";
import { StoryTextEditor } from "./StoryTextEditor";
export function StoryCreator({
  onClose,
  initialMode = "camera",
  initialText,
}: {
  onClose: () => void;
  initialMode?: "camera" | "gallery" | "text";
  initialText?: string;
}) {
  const {
    say,
    language,
    mine,
    mode,
    setMode,
    file,
    url,
    caption,
    setCaption,
    error,
    busy,
    setBusy,
    progress,
    locked,
    ready,
    select,
    clear,
    publish,
    cancelPending,
  } = useStoryCreator(onClose, initialMode);
  const mediaPaneRef = useRef<HTMLDivElement>(null);
  const [pasteHint, setPasteHint] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const handleImages = useCallback(
    (files: File[]) => {
      setPasteHint("");
      if (files[0]) void select(files[0]);
    },
    [select],
  );

  const handleFeedback = useCallback((message: string) => {
    setPasteHint(message);
  }, []);

  useClipboardImageTarget({
    ref: mediaPaneRef,
    kind: "single-image",
    disabled: mode === "text" || busy || locked,
    maxFileBytes: 50 * 1024 * 1024,
    onImages: handleImages,
    onFeedback: handleFeedback,
  });

  return (
    <StoryOverlay
      title={say("Create story", "Crear historia")}
      className="story-creator"
      onClose={onClose}
      canClose={!busy}
      onDismiss={cancelPending}
    >
      {(close) => (
        <>
          {mode === "text" ? (
            <StoryTextEditor
              initialText={initialText}
              onClose={() => (initialMode === "text" ? close() : setMode("camera"))}
              onSaved={onClose}
              onBusyChange={setBusy}
            />
          ) : (
            <section
              ref={mediaPaneRef}
              className="story-media-pane"
              aria-label={say("Story media", "Archivo de historia")}
              onDragOver={(e) => {
                if (busy || locked) return;
                if (e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes("Files")) {
                  e.preventDefault();
                  if (!dragActive) setDragActive(true);
                }
              }}
              onDragLeave={(e) => {
                if (dragActive && !e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDragActive(false);
                }
              }}
              onDrop={(e) => {
                setDragActive(false);
                if (busy || locked || !e.dataTransfer?.files?.length) return;
                e.preventDefault();
                const extraction = extractDataTransferMedia(e.dataTransfer, {
                  maxCount: 1,
                  existingCount: 0,
                  maxFileBytes: 50 * 1024 * 1024,
                  strictImagesOnly: true,
                });
                if (extraction.images[0]) handleImages(extraction.images);
                const msg = formatClipboardFeedback(extraction, language, {
                  maxCount: 1,
                  maxFileBytes: 50 * 1024 * 1024,
                  singleImageMode: true,
                });
                if (msg) setPasteHint(msg);
              }}
            >
              <div
                className="story-create-preview"
                data-drag-active={dragActive || undefined}
              >
                {file?.type.startsWith("video/") ? (
                  <video src={url} controls playsInline>
                    <track kind="captions" />
                  </video>
                ) : file ? (
                  <>
                    <img src={url} alt={say("Story preview", "Vista previa de historia")} />
                    {!busy && !locked && (
                      <button
                        type="button"
                        className="story-clear-media"
                        aria-label={say("Remove selected media", "Quitar archivo seleccionado")}
                        onClick={() => {
                          setPasteHint("");
                          clear();
                        }}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    )}
                  </>
                ) : (
                  <p className="story-create-empty">
                    <Camera size={32} aria-hidden="true" />
                    {say(
                      "Choose a photo, paste an image, or pick a video up to 15 seconds",
                      "Elige una foto, pega una imagen o selecciona un video de hasta 15 segundos",
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
              <label className="story-file-picker">
                {mode === "camera"
                  ? say("Open camera", "Abrir cámara")
                  : say("Choose from gallery", "Elegir de galería")}
                <input
                  type="file"
                  accept="image/*,video/*"
                  capture={mode === "camera" ? "environment" : undefined}
                  disabled={busy || locked}
                  onChange={(e) => {
                    setPasteHint("");
                    void select(e.target.files?.[0]);
                  }}
                />
              </label>
              {(error || pasteHint) && <p role="alert">{error || pasteHint}</p>}
              {busy && (
                <progress
                  aria-label={say("Upload progress", "Progreso de carga")}
                  max={100}
                  value={progress}
                />
              )}
              <div className="modal-actions">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={busy}
                  onClick={close}
                >
                  {say("Cancel", "Cancelar")}
                </Button>
                <Button
                  type="button"
                  className="rounded-xl"
                  disabled={busy || !ready || mine.data.length >= 10}
                  onClick={publish}
                >
                  {say("Send story", "Enviar historia")}
                </Button>
              </div>
              {mine.data.length >= 10 && (
                <p role="alert">
                  {say(
                    "You can have up to 10 active stories",
                    "Puedes tener hasta 10 historias activas",
                  )}
                </p>
              )}
            </section>
          )}
          <nav className="story-create-modes" aria-label={say("Story mode", "Tipo de historia")}>
            {(["camera", "gallery", "text"] as const).map((m) => (
              <Button
                type="button"
                key={m}
                variant="ghost"
                disabled={busy || locked}
                aria-pressed={m === mode}
                onClick={() => {
                  setPasteHint("");
                  setMode(m);
                }}
              >
                {m === "camera"
                  ? say("Camera", "Cámara")
                  : m === "gallery"
                    ? say("Gallery", "Galería")
                    : say("Text", "Texto")}
              </Button>
            ))}
          </nav>
        </>
      )}
    </StoryOverlay>
  );
}
