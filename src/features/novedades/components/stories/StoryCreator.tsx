import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoryOverlay } from "@/components/ui/story-overlay";
import { useStoryCreator } from "../../hooks/stories/useStoryCreator";
import { StoryTextEditor } from "./StoryTextEditor";
export function StoryCreator({ onClose }: { onClose: () => void }) {
  const {
    say,
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
    publish,
    cancelPending,
  } = useStoryCreator(onClose);
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
                  <p className="story-create-empty">
                    <Camera size={32} aria-hidden="true" />
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
              <label className="story-file-picker">
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
            </>
          )}
          <nav className="story-create-modes" aria-label={say("Story mode", "Tipo de historia")}>
            {(["camera", "gallery", "text"] as const).map((m) => (
              <Button
                type="button"
                key={m}
                variant="ghost"
                disabled={busy || locked}
                aria-pressed={m === mode}
                onClick={() => setMode(m)}
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
