import { ArrowUp, FileText, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "@/features/auth/components";
import { useMediaSend } from "../hooks/useMediaSend";
import { useMessageText } from "../i18n";
import type { SendInput } from "../types";
import { formatBytes } from "../utils/formatMessageTime";
export function MediaPreviewModal({
  file,
  chatId,
  channelMode = false,
  onSend,
  onClose,
}: {
  file: File;
  chatId: string;
  channelMode?: boolean;
  onSend: (input: SendInput) => Promise<void>;
  onClose: () => void;
}) {
  const { say, language } = useMessageText();
  const [url, setUrl] = useState<string>();
  const { caption, setCaption, error, sending, upload, close, send } = useMediaSend({
    file,
    chatId,
    channelMode,
    onSend,
    onClose,
  });
  const media = file.type.startsWith("image/") || file.type.startsWith("video/");
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
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
          onClick={() => void send()}
        >
          <ArrowUp size={18} />
          {say("Send", "Enviar")}
        </button>
      </div>
    </Modal>
  );
}
