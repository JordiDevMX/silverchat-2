import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import type { Upload } from "../types";
export async function getSignedUrl(upload: Upload, download = false) {
  const result = await supabase.storage
    .from(upload.bucket)
    .createSignedUrl(
      upload.path,
      300,
      download ? { download: upload.original_filename } : undefined,
    );
  if (result.error) throw result.error;
  return result.data.signedUrl;
}
export function useMediaUrl(upload: Upload | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["message-media", user?.id, upload?.id, upload?.path],
    enabled: !!upload,
    staleTime: 240000,
    gcTime: 240000,
    refetchInterval: 240000,
    queryFn: () => {
      if (!upload) throw new Error("Media unavailable");
      return getSignedUrl(upload);
    },
  });
}
export async function downloadMedia(upload: Upload) {
  // A same-window anchor avoids popup blocking after asynchronous signing.
  const url = await getSignedUrl(upload, true);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = upload.original_filename;
  anchor.rel = "noopener noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
