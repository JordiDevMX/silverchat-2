import { Play } from "lucide-react";
import { useRef } from "react";
import { useInView } from "@/hooks/useInView";
import { isStorageOutage } from "@/lib/storage-health";
import { useMessageText } from "../../i18n";
import { useMediaUrl } from "../../lib/media";
import type { Message } from "../../types";

export function VideoMessage({ message, onOpen }: { message: Message; onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const isInView = useInView(ref, { rootMargin: "100px" });
  const poster = useMediaUrl(message.thumbnail, { enabled: isInView });
  const { say } = useMessageText();
  const isOutage = !poster.data && (poster.isError || isStorageOutage());
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`message-image message-video ${isOutage ? "media-outage-placeholder" : ""}`}
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
