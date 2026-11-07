import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SharedFileRowSurface } from "@/components/ui/chat-settings-surfaces";
import { FileIconTile } from "@/components/ui/file-icon-tile";
import { useMessageText } from "@/features/messages/i18n";
import type { Message } from "@/features/messages/types";
import { formatBytes } from "@/features/messages/utils/formatMessageTime";
import { resolveFileType } from "@/lib/file-type";
import { useSharedFileDownload } from "../hooks/useSharedFileDownload";

function FileRow({ message }: { message: Message }) {
  const { say, language } = useMessageText();
  const upload = message.upload;
  const { error, busy, download } = useSharedFileDownload(upload);
  const name = upload?.original_filename ?? say("File unavailable", "Archivo no disponible");
  const fileType = resolveFileType({ filename: name, mimeType: upload?.mime_type });
  return (
    <SharedFileRowSurface
      name={name}
      icon={<FileIconTile family={fileType.family} />}
      details={
        <>
          {upload && `${formatBytes(upload.size_bytes, language)} · `}
          {say(fileType.label[0], fileType.label[1])} ·{" "}
          {new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(
            new Date(message.created_at),
          )}
        </>
      }
      action={
        <Button
          variant="ghost"
          size="icon"
          disabled={!upload || busy}
          aria-label={say("Download file", "Descargar archivo")}
          onClick={download}
        >
          <Download />
        </Button>
      }
      error={
        error && (
          <p role="alert">
            {say(
              "Download failed. Allow pop-ups and try again.",
              "La descarga falló. Permite ventanas emergentes e inténtalo de nuevo.",
            )}
          </p>
        )
      }
    />
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
