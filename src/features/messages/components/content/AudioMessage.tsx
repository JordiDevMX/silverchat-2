import { useRef } from "react";
import { useInView } from "@/hooks/useInView";
import { useMessageText } from "../../i18n";
import { useMediaUrl } from "../../lib/media";
import type { Message } from "../../types";
import { VoicePlayer } from "../VoicePlayer";
import { DownloadButton } from "./FileMessage";

export function AudioMessage({ message }: { message: Message }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { rootMargin: "100px" });
  const url = useMediaUrl(message.upload, { enabled: isInView });
  const { say } = useMessageText();
  return (
    <div ref={ref}>
      <VoicePlayer
        id={message.id}
        url={url.data}
        peaks={message.media_peaks ?? Array.from({ length: 40 }, () => 25)}
        duration={message.upload?.duration_seconds ?? 0}
      />
      {!message.media_peaks && (
        <span>{message.upload?.original_filename ?? say("Audio", "Audio")}</span>
      )}
      <DownloadButton upload={message.upload} />
      {url.isError && <p role="alert">{say("Audio unavailable", "Audio no disponible")}</p>}
      {message.content && <p className="message-text">{message.content}</p>}
    </div>
  );
}
