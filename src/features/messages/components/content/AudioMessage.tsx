import { useMessageText } from "../../i18n";
import { useMediaUrl } from "../../lib/media";
import type { Message } from "../../types";
import { VoicePlayer } from "../VoicePlayer";
import { DownloadButton } from "./FileMessage";
export function AudioMessage({ message }: { message: Message }) {
  const url = useMediaUrl(message.upload);
  const { say } = useMessageText();
  return (
    <>
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
    </>
  );
}
