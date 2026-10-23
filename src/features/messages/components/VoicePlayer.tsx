import { Pause, Play } from "lucide-react";
import { useVoicePlayback } from "../hooks/useVoicePlayback";
import { useMessageText } from "../i18n";
import { formatVoiceTime } from "../lib/voicePeaks";
export function VoicePlayer({
  id,
  url,
  peaks,
  duration = 0,
}: {
  id: string;
  url?: string;
  peaks: number[];
  duration?: number;
}) {
  const player = useVoicePlayback(id);
  const { say, language } = useMessageText();
  const length = player.duration || duration;
  return (
    <div className="voice-player">
      <button
        type="button"
        className="message-icon"
        disabled={!url}
        aria-label={
          player.playing
            ? say("Pause audio", "Pausar audio")
            : say("Play audio", "Reproducir audio")
        }
        onClick={() => void player.play()}
      >
        {player.playing ? <Pause /> : <Play />}
      </button>
      <div className="voice-track">
        <svg viewBox="0 0 160 40" aria-hidden="true">
          {peaks.map((peak, i) => (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: Fixed waveform slots have no identity or state.
              key={`peak-${i}-${peak}`}
              x={i * 4}
              y={20 - Math.max(2, peak * 0.38) / 2}
              width="2.5"
              height={Math.max(2, peak * 0.38)}
              rx="1"
              className={i / peaks.length < player.position / (length || 1) ? "played" : ""}
            />
          ))}
        </svg>
        <input
          type="range"
          aria-label={say("Audio position", "Posición del audio")}
          min={0}
          max={length || 1}
          step={0.1}
          value={Math.min(player.position, length || 1)}
          onChange={(e) => player.seek(Number(e.target.value))}
        />
      </div>
      <small>{formatVoiceTime(player.playing ? player.position : length, language)}</small>
      <audio ref={player.ref} src={url} preload="metadata" {...player.audioProps}>
        <track kind="captions" />
      </audio>
      {player.error && <span role="alert">{say("Audio unavailable", "Audio no disponible")}</span>}
    </div>
  );
}
