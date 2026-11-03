import { Download } from "lucide-react";
import { FileIconTile } from "@/components/ui/file-icon-tile";
import { resolveFileType } from "@/lib/file-type";
import { useAttachmentDownload } from "../../hooks/useAttachmentDownload";
import { useMessageText } from "../../i18n";
import type { Message, Upload } from "../../types";
import { formatBytes } from "../../utils/formatMessageTime";
export function DownloadButton({ upload }: { upload: Upload | undefined }) {
  const { say } = useMessageText();
  const { error, busy, download } = useAttachmentDownload(upload);
  return (
    <>
      <button
        type="button"
        className="message-icon"
        disabled={!upload || busy}
        aria-label={say("Download attachment", "Descargar archivo")}
        onClick={download}
      >
        <Download size={18} />
      </button>
      {error && (
        <span role="alert">
          {say("Download failed. Try again.", "La descarga falló. Inténtalo de nuevo.")}
        </span>
      )}
    </>
  );
}
export function FileMessage({ message }: { message: Message }) {
  const { language, say } = useMessageText();
  const name =
    message.upload?.original_filename ?? say("Attachment unavailable", "Archivo no disponible");
  const fileType = resolveFileType({ filename: name, mimeType: message.upload?.mime_type });
  return (
    <>
      <div className="message-file">
        <FileIconTile family={fileType.family} />
        <div>
          <strong title={name}>{name.length > 40 ? `${name.slice(0, 37)}…` : name}</strong>
          <small>
            {message.upload && `${formatBytes(message.upload.size_bytes, language)} · `}
            {say(fileType.label[0], fileType.label[1])}
          </small>
        </div>
        <DownloadButton upload={message.upload} />
      </div>
      {message.content && <p className="message-text">{message.content}</p>}
    </>
  );
}
