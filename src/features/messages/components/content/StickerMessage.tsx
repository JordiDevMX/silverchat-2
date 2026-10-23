import { useMessageText } from "../../i18n";
import { useMediaUrl } from "../../lib/media";
import type { Message } from "../../types";
export function StickerMessage({ message }: { message: Message }) {
  const url = useMediaUrl(message.upload);
  const { say } = useMessageText();
  return url.data ? (
    <img
      className="message-sticker"
      src={url.data}
      alt={say("Sticker", "Sticker")}
      loading="lazy"
    />
  ) : (
    <span>{say("Sticker unavailable", "Sticker no disponible")}</span>
  );
}
