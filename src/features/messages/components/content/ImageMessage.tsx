import { useRef, useState } from "react";
import { useInView } from "@/hooks/useInView";
import { isStorageOutage } from "@/lib/storage-health";
import { useMessageText } from "../../i18n";
import { useMediaUrl } from "../../lib/media";
import type { Message } from "../../types";

export function ImageMessage({ message, onOpen }: { message: Message; onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const isInView = useInView(ref, { rootMargin: "100px" });
  const url = useMediaUrl(message.upload, { enabled: isInView });
  const [broken, setBroken] = useState<string>();
  const { say } = useMessageText();
  const isOutage = url.isError || isStorageOutage();
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`message-image ${isOutage ? "media-outage-placeholder" : ""}`}
        onClick={onOpen}
        aria-label={say("Open image", "Abrir imagen")}
        style={{ aspectRatio: `${message.upload?.width ?? 4}/${message.upload?.height ?? 3}` }}
      >
        {url.data && broken !== url.data ? (
          <img
            src={url.data}
            alt={message.content ?? say("Image attachment", "Imagen adjunta")}
            loading="lazy"
            onError={() => setBroken(url.data)}
          />
        ) : (
          <span>
            {url.isError || (!!broken && broken === url.data)
              ? say("Image unavailable", "Imagen no disponible")
              : say("Loading image…", "Cargando imagen…")}
          </span>
        )}
      </button>
      {message.content && <p className="message-text">{message.content}</p>}
    </>
  );
}
