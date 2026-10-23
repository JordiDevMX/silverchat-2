import { useState } from "react";
import { useMessageText } from "../../i18n";
import { useMediaUrl } from "../../lib/media";
import type { Message } from "../../types";
export function ImageMessage({ message, onOpen }: { message: Message; onOpen: () => void }) {
  const url = useMediaUrl(message.upload);
  const [broken, setBroken] = useState<string>();
  const { say } = useMessageText();
  return (
    <>
      <button
        type="button"
        className="message-image"
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
