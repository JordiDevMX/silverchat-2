import { useState } from "react";
import { useMessageText } from "../i18n";
import type { SendInput } from "../types";
import { useUploadProgress } from "./useUploadProgress";
import type { useVoiceRecorder } from "./useVoiceRecorder";
export function useVoiceSend({
  recorder,
  chatId,
  channelMode,
  onSend,
  onClose,
}: {
  recorder: ReturnType<typeof useVoiceRecorder>;
  chatId: string;
  channelMode: boolean;
  onSend: (input: SendInput) => Promise<void>;
  onClose: () => void;
}) {
  const { say } = useMessageText();
  const upload = useUploadProgress(chatId, channelMode);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const cancel = () => {
    if (sending) return;
    upload.cancel();
    recorder.cancel();
    onClose();
  };
  const send = async () => {
    const value = recorder.recording;
    if (!value || sending) return;
    setSending(true);
    setError("");
    let enqueued = false;
    try {
      const result = await upload.upload(value.file, { durationSeconds: value.duration });
      enqueued = true;
      await onSend({
        type: "audio",
        content: null,
        file_upload_id: result.upload.id,
        media_peaks: value.peaks,
        upload: result.upload,
      });
      recorder.cancel();
      onClose();
    } catch {
      if (enqueued) {
        recorder.cancel();
        onClose();
      } else setError(say("Upload failed. Try again.", "No se pudo subir. Inténtalo de nuevo."));
    } finally {
      setSending(false);
    }
  };
  return { upload, sending, error, cancel, send };
}
