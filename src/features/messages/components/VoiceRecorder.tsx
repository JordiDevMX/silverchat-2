import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { VoiceWaveform } from "@/components/ui/messaging";
import type { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { useVoiceSend } from "../hooks/useVoiceSend";
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
  const touch = useRef<number | null>(null);
  const { upload, sending, error, cancel, send } = useVoiceSend({
    recorder,
    chatId,
    channelMode,
    onSend,
    onClose,
  });
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
      <Button
        type="button"
        variant="outline"
        className="rounded-xl"
        disabled={sending}
        onClick={cancel}
      >
        {say("Discard", "Descartar")}
      </Button>
      {recorder.state === "recording" ? (
        <>
          <span className="recording-dot" />
          <time>{formatVoiceTime(recorder.elapsed, language)}</time>
          <VoiceWaveform live peaks={recorder.livePeaks} />
          <Button type="button" className="rounded-xl" onClick={recorder.stop}>
            {say("Stop recording", "Detener grabación")}
          </Button>
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
          <Button
            type="button"
            className="rounded-xl"
            disabled={sending}
            onClick={() => void send()}
          >
            {sending ? `${upload.progress}%` : say("Send voice note", "Enviar nota de voz")}
          </Button>
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
      {recorder.limitReached && (
        <p role="status">{say("Maximum 5 minutes reached", "Se alcanzó el máximo de 5 minutos")}</p>
      )}
    </div>
  );
}
