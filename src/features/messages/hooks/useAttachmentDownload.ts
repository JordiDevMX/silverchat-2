import { useState } from "react";
import { downloadMedia } from "../lib/media";
import type { Upload } from "../types";

export function useAttachmentDownload(upload: Upload | undefined) {
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const download = async () => {
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
  };
  return { error, busy, download };
}
