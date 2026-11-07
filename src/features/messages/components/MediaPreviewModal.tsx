import { ArrowUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileIconTile } from "@/components/ui/file-icon-tile";
import { Modal } from "@/features/auth/components";
import { resolveFileType } from "@/lib/file-type";
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
  const fileType = resolveFileType({ filename: file.name, mimeType: file.type });
  const media = file.type.startsWith("image/") || file.type.startsWith("video/");
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return (
    <Modal
      title={say("Send attachment", "Enviar archivo")}
      className="media-preview messaging-dialog"
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
            <FileIconTile family={fileType.family} />
            <p>{file.name}</p>
            <small>
              {formatBytes(file.size, language)} · {say(fileType.label[0], fileType.label[1])}
            </small>
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
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={sending && !upload.uploading}
          onClick={close}
        >
          {say("Cancel", "Cancelar")}
        </Button>
        <Button type="button" className="rounded-xl" disabled={sending} onClick={() => void send()}>
          <ArrowUp size={18} />
          {say("Send", "Enviar")}
        </Button>
      </div>
    </Modal>
  );
}
