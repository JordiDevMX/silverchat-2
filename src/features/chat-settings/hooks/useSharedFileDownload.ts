import { useState } from "react";
import { getSignedUrl } from "@/features/messages/lib/media";
import type { Upload } from "@/features/messages/types";

export function useSharedFileDownload(upload: Upload | undefined) {
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const download = async () => {
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
  };
  return { error, busy, download };
}
