import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useMessageText } from "../i18n";
import { useMediaUrl } from "../lib/media";
import type { Message } from "../types";
import { DownloadButton } from "./content/FileMessage";
export function MediaLightbox({ message, onClose }: { message: Message; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const url = useMediaUrl(message.upload);
  const { say } = useMessageText();
  useEffect(() => {
    ref.current?.showModal();
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="media-lightbox"
      aria-label={say("Media viewer", "Visor multimedia")}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <button
        className="lightbox-backdrop"
        type="button"
        aria-label={say("Close viewer", "Cerrar visor")}
        onClick={onClose}
      />
      <div className="lightbox-toolbar">
        <DownloadButton upload={message.upload} />
        <button
          className="message-icon"
          type="button"
          aria-label={say("Close", "Cerrar")}
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      <div className="lightbox-content">
        {url.data ? (
          message.type === "video" ? (
            <video src={url.data} controls autoPlay playsInline>
              <track kind="captions" />
            </video>
          ) : (
            <img src={url.data} alt={message.content ?? ""} />
          )
        ) : (
          <p>
            {url.isError
              ? say("Media unavailable", "Archivo no disponible")
              : say("Loading…", "Cargando…")}
          </p>
        )}
      </div>
    </dialog>
  );
}
