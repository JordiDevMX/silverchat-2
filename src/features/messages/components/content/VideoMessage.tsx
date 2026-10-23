import { Play } from "lucide-react";
import { useMessageText } from "../../i18n";
import { useMediaUrl } from "../../lib/media";
import type { Message } from "../../types";
export function VideoMessage({ message, onOpen }: { message: Message; onOpen: () => void }) {
  const poster = useMediaUrl(message.thumbnail);
  const { say } = useMessageText();
  return (
    <>
      <button
        type="button"
        className="message-image message-video"
        onClick={onOpen}
        aria-label={say("Play video", "Reproducir video")}
        style={{ aspectRatio: `${message.upload?.width ?? 4}/${message.upload?.height ?? 3}` }}
      >
        {poster.data && <img src={poster.data} alt="" loading="lazy" />}
        <span className="video-play">
          <Play size={28} />
        </span>
      </button>
      {message.content && <p className="message-text">{message.content}</p>}
    </>
  );
}
