import { useRef } from "react";
import { useInView } from "@/hooks/useInView";
import { useMessageText } from "../../i18n";
import { useMediaUrl } from "../../lib/media";
import type { Message } from "../../types";

export function StickerMessage({ message }: { message: Message }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { rootMargin: "100px" });
  const url = useMediaUrl(message.upload, { enabled: isInView });
  const { say } = useMessageText();
  return (
    <span ref={ref}>
      {url.data ? (
        <img
          className="message-sticker"
          src={url.data}
          alt={say("Sticker", "Sticker")}
          loading="lazy"
        />
      ) : (
        <span>{say("Sticker unavailable", "Sticker no disponible")}</span>
      )}
    </span>
  );
}
