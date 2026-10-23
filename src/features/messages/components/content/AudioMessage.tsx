import { Pause, Play } from "lucide-react";
import { useRef, useState } from "react";
import { useMessageText } from "../../i18n";
import { useMediaUrl } from "../../lib/media";
import type { Message } from "../../types";
import { DownloadButton } from "./FileMessage";
export function AudioMessage({ message }: { message: Message }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(message.upload?.duration_seconds ?? 0);
  const [error, setError] = useState(false);
  const url = useMediaUrl(message.upload);
  const { say } = useMessageText();
  const seconds = Math.floor(duration);
  return (
    <>
      <div className="message-audio">
        <button
          type="button"
          className="message-icon"
          aria-label={
            playing ? say("Pause audio", "Pausar audio") : say("Play audio", "Reproducir audio")
          }
          disabled={!url.data}
          onClick={async () => {
            if (playing) audio.current?.pause();
            else
              try {
                await audio.current?.play();
                setError(false);
              } catch {
                setError(true);
              }
          }}
        >
          {playing ? <Pause /> : <Play />}
        </button>
        <div>
          <span>{message.upload?.original_filename ?? say("Audio", "Audio")}</span>
          <input
            aria-label={say("Audio position", "Posición del audio")}
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={current}
            onChange={(e) => {
              if (audio.current) audio.current.currentTime = Number(e.target.value);
              setCurrent(Number(e.target.value));
            }}
          />
          <small>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </small>
        </div>
        <DownloadButton upload={message.upload} />
      </div>
      <audio
        ref={audio}
        src={url.data}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={() => setCurrent(audio.current?.currentTime ?? 0)}
        onLoadedMetadata={() =>
          setDuration(Number.isFinite(audio.current?.duration) ? (audio.current?.duration ?? 0) : 0)
        }
        onError={() => setError(true)}
      >
        <track kind="captions" />
      </audio>
      {(error || url.isError) && (
        <p role="alert">{say("Audio unavailable", "Audio no disponible")}</p>
      )}
      {message.content && <p className="message-text">{message.content}</p>}
    </>
  );
}
