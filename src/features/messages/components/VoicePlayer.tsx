import { Pause, Play } from "lucide-react";
import { VoiceWaveform } from "@/components/ui/messaging";
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
        className="message-icon voice-toggle"
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
        <VoiceWaveform peaks={peaks} progress={player.position / (length || 1)} />
        <input
          type="range"
          aria-label={say("Audio position", "Posición del audio")}
          aria-valuetext={`${formatVoiceTime(player.position, language)} / ${formatVoiceTime(length, language)}`}
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
