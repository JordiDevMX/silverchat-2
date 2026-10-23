import { Download, File, FileArchive, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { useMessageText } from "../../i18n";
import { downloadMedia } from "../../lib/media";
import type { Message, Upload } from "../../types";
import { formatBytes } from "../../utils/formatMessageTime";
export function DownloadButton({ upload }: { upload: Upload | undefined }) {
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const { say } = useMessageText();
  return (
    <>
      <button
        type="button"
        className="message-icon"
        disabled={!upload || busy}
        aria-label={say("Download attachment", "Descargar archivo")}
        onClick={async () => {
          if (!upload) return;
          setBusy(true);
          setError(false);
          try {
            await downloadMedia(upload);
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
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
  const ext = name.split(".").at(-1)?.toLowerCase();
  const Icon = ["zip", "rar", "7z"].includes(ext ?? "")
    ? FileArchive
    : ["xlsx", "csv"].includes(ext ?? "")
      ? FileSpreadsheet
      : ["pdf", "docx", "txt"].includes(ext ?? "")
        ? FileText
        : File;
  return (
    <>
      <div className="message-file">
        <Icon size={30} />
        <div>
          <strong title={name}>{name.length > 40 ? `${name.slice(0, 37)}…` : name}</strong>
          <small>{message.upload && formatBytes(message.upload.size_bytes, language)}</small>
        </div>
        <DownloadButton upload={message.upload} />
      </div>
      {message.content && <p className="message-text">{message.content}</p>}
    </>
  );
}
