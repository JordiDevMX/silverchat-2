import { Download, File, FileArchive, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { useMessageText } from "@/features/messages/i18n";
import { getSignedUrl } from "@/features/messages/lib/media";
import type { Message } from "@/features/messages/types";
import { formatBytes } from "@/features/messages/utils/formatMessageTime";

function FileRow({ message }: { message: Message }) {
  const { say, language } = useMessageText();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const upload = message.upload;
  const name = upload?.original_filename ?? say("File unavailable", "Archivo no disponible");
  const ext = name.split(".").at(-1)?.toLowerCase() ?? "";
  const Icon = ["pdf", "docx", "txt"].includes(ext)
    ? FileText
    : ["xlsx", "csv"].includes(ext)
      ? FileSpreadsheet
      : ["zip", "rar", "7z"].includes(ext)
        ? FileArchive
        : File;
  return (
    <div className="shared-file-row">
      <Icon />
      <span>
        <strong title={name}>{name.length > 40 ? `${name.slice(0, 37)}…` : name}</strong>
        <small>
          {upload && formatBytes(upload.size_bytes, language)} ·{" "}
          {new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(
            new Date(message.created_at),
          )}
        </small>
      </span>
      <button
        type="button"
        className="message-icon"
        disabled={!upload || busy}
        aria-label={say("Download file", "Descargar archivo")}
        onClick={async () => {
          if (!upload) return;
          const tab = window.open("about:blank", "_blank");
          if (tab) tab.opener = null;
          setBusy(true);
          setError(false);
          try {
            const url = await getSignedUrl(upload, true);
            if (!tab) throw new Error("Popup blocked");
            tab.location.replace(url);
          } catch {
            tab?.close();
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download />
      </button>
      {error && (
        <p role="alert">
          {say(
            "Download failed. Allow pop-ups and try again.",
            "La descarga falló. Permite ventanas emergentes e inténtalo de nuevo.",
          )}
        </p>
      )}
    </div>
  );
}
export function SharedFilesTab({ messages }: { messages: Message[] }) {
  return (
    <div className="shared-files">
      {messages.map((message) => (
        <FileRow key={message.id} message={message} />
      ))}
    </div>
  );
}
