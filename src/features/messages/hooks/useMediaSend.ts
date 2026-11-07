import { useState } from "react";
import { useMessageText } from "../i18n";
import type { SendInput } from "../types";
import { useUploadProgress } from "./useUploadProgress";
export function useMediaSend({
  file,
  chatId,
  channelMode,
  onSend,
  onClose,
}: {
  file: File;
  chatId: string;
  channelMode: boolean;
  onSend: (input: SendInput) => Promise<void>;
  onClose: () => void;
}) {
  const { say } = useMessageText();
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const upload = useUploadProgress(chatId, channelMode);
  const close = () => {
    if (sending && !upload.uploading) return;
    upload.cancel();
    onClose();
  };
  const send = async () => {
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
        setError(say("Upload failed. Please try again.", "La carga falló. Inténtalo de nuevo."));
    } finally {
      setSending(false);
    }
  };
  return { caption, setCaption, error, sending, upload, close, send };
}
