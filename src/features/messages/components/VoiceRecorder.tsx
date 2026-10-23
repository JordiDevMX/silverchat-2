import { useRef, useState } from "react";
import { useUploadProgress } from "../hooks/useUploadProgress";
import type { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { useMessageText } from "../i18n";
import { formatVoiceTime } from "../lib/voicePeaks";
import type { SendInput } from "../types";
import { VoicePlayer } from "./VoicePlayer";
export function VoiceRecorder({
  recorder,
  chatId,
  channelMode = false,
  onSend,
  onClose,
}: {
  recorder: ReturnType<typeof useVoiceRecorder>;
  chatId: string;
  channelMode?: boolean;
  onSend: (input: SendInput) => Promise<void>;
  onClose: () => void;
}) {
  const { say, language } = useMessageText();
  const upload = useUploadProgress(chatId, channelMode);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const touch = useRef<number | null>(null);
  const cancel = () => {
    if (sending) return;
    upload.cancel();
    recorder.cancel();
    onClose();
  };
  const send = async () => {
    const value = recorder.recording;
    if (!value || sending) return;
    setSending(true);
    setError("");
    let enqueued = false;
    try {
      const result = await upload.upload(value.file, { durationSeconds: value.duration });
      enqueued = true;
      await onSend({
        type: "audio",
        content: null,
        file_upload_id: result.upload.id,
        media_peaks: value.peaks,
        upload: result.upload,
      });
      recorder.cancel();
      onClose();
    } catch {
      if (enqueued) {
        recorder.cancel();
        onClose();
      } else setError(say("Upload failed. Try again.", "No se pudo subir. Inténtalo de nuevo."));
    } finally {
      setSending(false);
    }
  };
  return (
    <div
      className="voice-recorder"
      onTouchStart={(e) => {
        touch.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const end = e.changedTouches[0]?.clientX;
        if (
          recorder.state === "recording" &&
          touch.current !== null &&
          end !== undefined &&
          touch.current - end > 100
        )
          cancel();
        touch.current = null;
      }}
    >
      <button type="button" className="button secondary" disabled={sending} onClick={cancel}>
        {say("Discard", "Descartar")}
      </button>
      {recorder.state === "recording" ? (
        <>
          <span className="recording-dot" />
          <time>{formatVoiceTime(recorder.elapsed, language)}</time>
          <svg className="live-wave" viewBox="0 0 160 40" aria-hidden="true">
            {recorder.livePeaks.map((peak, i) => (
              <rect
                // biome-ignore lint/suspicious/noArrayIndexKey: Fixed waveform slots have no identity or state.
                key={`live-${i}-${peak}`}
                x={i * 4}
                y={20 - Math.max(2, peak * 0.4) / 2}
                width="2"
                height={Math.max(2, peak * 0.4)}
              />
            ))}
          </svg>
          <button type="button" className="button primary" onClick={recorder.stop}>
            {say("Stop recording", "Detener grabación")}
          </button>
          <small>
            {say(
              "Slide left to cancel · 5 minute limit",
              "Desliza a la izquierda para cancelar · Máximo 5 minutos",
            )}
          </small>
        </>
      ) : recorder.recording ? (
        <>
          <VoicePlayer
            id={`preview-${chatId}`}
            url={recorder.recording.url}
            peaks={recorder.recording.peaks}
            duration={recorder.recording.duration}
          />
          <button
            type="button"
            className="button primary"
            disabled={sending}
            onClick={() => void send()}
          >
            {sending ? `${upload.progress}%` : say("Send voice note", "Enviar nota de voz")}
          </button>
        </>
      ) : recorder.state === "error" ? (
        <p role="alert">
          {recorder.error === "permission"
            ? say(
                "Microphone access denied. Allow it in your browser and try again.",
                "Permite el micrófono en tu navegador e inténtalo de nuevo.",
              )
            : recorder.error === "unsupported"
              ? say(
                  "Voice recording is unavailable in this browser.",
                  "Este navegador no admite grabación de voz.",
                )
              : say(
                  "Unable to record audio. Please try again.",
                  "No se pudo grabar audio. Inténtalo de nuevo.",
                )}
        </p>
      ) : (
        <p role="status">
          {recorder.state === "requesting"
            ? say("Waiting for microphone…", "Esperando micrófono…")
            : say("Preparing voice note…", "Preparando nota de voz…")}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
