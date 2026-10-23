import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { prepareAndUpload } from "../lib/upload";
export function useUploadProgress(chatId: string) {
  const { user } = useAuth();
  const controller = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  useEffect(() => () => controller.current?.abort(), []);
  return {
    progress,
    uploading,
    cancel: () => controller.current?.abort(),
    upload: async (file: File) => {
      if (controller.current) throw new Error("An upload is already in progress");
      const next = new AbortController();
      controller.current = next;
      setProgress(0);
      setUploading(true);
      try {
        return await prepareAndUpload(file, chatId, user?.id ?? "", next.signal, setProgress);
      } finally {
        controller.current = null;
        setUploading(false);
      }
    },
  };
}
