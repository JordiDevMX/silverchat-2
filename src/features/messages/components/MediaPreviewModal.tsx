import { ArrowUp, FileText, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "@/features/auth/components";
import { useUploadProgress } from "../hooks/useUploadProgress";
import { useMessageText } from "../i18n";
import type { SendInput } from "../types";
import { formatBytes } from "../utils/formatMessageTime";
export function MediaPreviewModal({
  file,
  chatId,
  onSend,
  onClose,
}: {
  file: File;
  chatId: string;
  onSend: (input: SendInput) => Promise<void>;
  onClose: () => void;
}) {
  const { say, language } = useMessageText();
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const upload = useUploadProgress(chatId);
  const media = file.type.startsWith("image/") || file.type.startsWith("video/");
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  const close = () => {
    if (sending && !upload.uploading) return;
    upload.cancel();
    onClose();
  };
  return (
    <Modal
      title={say("Send attachment", "Enviar archivo")}
      className="media-preview"
      onClose={close}
    >
      <button
        type="button"
        className="message-icon modal-close"
        disabled={sending && !upload.uploading}
        aria-label={say("Close", "Cerrar")}
        onClick={close}
      >
        <X />
      </button>
      <div className="media-preview-stage">
        {file.type.startsWith("image/") ? (
          <img src={url} alt={file.name} />
        ) : file.type.startsWith("video/") ? (
          <video src={url} controls playsInline preload="metadata">
            <track kind="captions" />
          </video>
        ) : (
          <div>
            <FileText size={64} />
            <p>{file.name}</p>
            <small>{formatBytes(file.size, language)}</small>
          </div>
        )}
      </div>
      <label>
        {say("Caption", "Descripción")}
        <textarea
          value={caption}
          disabled={sending}
          maxLength={media ? 500 : 200}
          onChange={(e) => setCaption(e.target.value)}
          rows={2}
        />
      </label>
      {sending && (
        <div role="status">
          <progress max={100} value={upload.progress} />
          <span>
            {upload.uploading ? `${Math.round(upload.progress)}%` : say("Sending…", "Enviando…")}
          </span>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions">
        <button
          type="button"
          className="button secondary"
          disabled={sending && !upload.uploading}
          onClick={close}
        >
          {say("Cancel", "Cancelar")}
        </button>
        <button
          type="button"
          className="button primary"
          disabled={sending}
          onClick={async () => {
            setSending(true);
            setError("");
            try {
              const result = await upload.upload(file);
              try {
                await onSend({
                  type: result.type,
                  content: caption.trim() || null,
                  file_upload_id: result.upload.id,
                  media_thumbnail_upload_id: result.thumbnail?.id,
                  upload: result.upload,
                  thumbnail: result.thumbnail,
                });
              } catch {
                /* The failed optimistic message owns these uploads and its retry UUID. */
              }
              onClose();
            } catch (e) {
              if (!(e instanceof DOMException && e.name === "AbortError"))
                setError(
                  say("Upload failed. Please try again.", "La carga falló. Inténtalo de nuevo."),
                );
            } finally {
              setSending(false);
            }
          }}
        >
          <ArrowUp size={18} />
          {say("Send", "Enviar")}
        </button>
      </div>
    </Modal>
  );
}
