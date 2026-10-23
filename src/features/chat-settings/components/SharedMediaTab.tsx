import { Play } from "lucide-react";
import { useState } from "react";
import { MediaLightbox } from "@/features/messages/components/MediaLightbox";
import { useMessageText } from "@/features/messages/i18n";
import { useMediaUrl } from "@/features/messages/lib/media";
import type { Message } from "@/features/messages/types";

function Tile({ message, onOpen }: { message: Message; onOpen: () => void }) {
  const { say } = useMessageText();
  const url = useMediaUrl(message.type === "video" ? message.thumbnail : message.upload);
  return (
    <button
      type="button"
      className="shared-media-tile"
      aria-label={
        message.type === "video"
          ? say("Open video", "Abrir video")
          : say("Open image", "Abrir imagen")
      }
      onClick={onOpen}
    >
      {url.data ? (
        <img src={url.data} alt="" loading="lazy" />
      ) : (
        <span>
          {url.isError
            ? say("Preview unavailable", "Vista previa no disponible")
            : say("Preview", "Vista previa")}
        </span>
      )}
      {message.type === "video" && <Play size={24} />}
    </button>
  );
}
export function SharedMediaTab({ messages }: { messages: Message[] }) {
  const [selected, setSelected] = useState<Message>();
  return (
    <>
      <div className="shared-media-grid">
        {messages.map((m) => (
          <Tile key={m.id} message={m} onOpen={() => setSelected(m)} />
        ))}
      </div>
      {selected && <MediaLightbox message={selected} onClose={() => setSelected(undefined)} />}
    </>
  );
}
