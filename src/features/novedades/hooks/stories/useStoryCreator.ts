import { useEffect, useRef, useState } from "react";
import { useMessageText } from "@/features/messages/i18n";
import { cleanupUploads, prepareAndUpload } from "@/features/messages/lib/upload";
import { videoThumbnail } from "@/features/messages/lib/videoThumbnail";
import type { Upload } from "@/features/messages/types";
import { useAuth } from "@/lib/auth-provider";
import { useCreateStory } from "./useCreateStory";
import { useMyStories } from "./useMyStories";
export function useStoryCreator(onClose: () => void) {
  const { user } = useAuth();
  const { say } = useMessageText();
  const create = useCreateStory();
  const mine = useMyStories();
  const [mode, setMode] = useState<"camera" | "gallery" | "text">("camera");
  const [file, setFile] = useState<File>();
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const tracked = useRef<Upload[]>([]);
  const attempted = useRef(false);
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  useEffect(
    () => () => {
      controller.current?.abort();
      if (!attempted.current) void cleanupUploads(tracked.current);
    },
    [],
  );
  const select = async (next?: File) => {
    if (!next) return;
    setError("");
    setReady(false);
    setFile(undefined);
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    try {
      if (!/^(image|video)\//.test(next.type)) throw new Error("Choose an image or video");
      if (next.size > 50 * 1024 * 1024) throw new Error("Choose a file below 50 MB");
      if (next.type.startsWith("video/")) {
        const info = await videoThumbnail(next, c.signal);
        if (info.duration > 15) throw new Error("Video must be at most 15 seconds");
      }
      c.signal.throwIfAborted();
      setFile(next);
      setReady(true);
    } catch (e) {
      if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Unable to read media");
    }
  };
  const publish = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    const c = new AbortController();
    controller.current = c;
    try {
      if (!tracked.current.length) {
        const result = await prepareAndUpload(
          file,
          user?.id ?? "",
          user?.id ?? "",
          c.signal,
          setProgress,
          { bucket: "story-media", maxVideoSeconds: 15 },
        );
        tracked.current = [result.upload, ...(result.thumbnail ? [result.thumbnail] : [])];
      }
      attempted.current = true;
      setLocked(true);
      await create.mutateAsync({
        p_media_type: file.type.startsWith("video/") ? "video" : "image",
        p_file_upload_id: tracked.current[0]?.id,
        p_thumbnail_upload_id: tracked.current[1]?.id,
        p_caption: caption.trim() || undefined,
      });
      tracked.current = [];
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to publish story. Retry when connected.");
    } finally {
      setBusy(false);
    }
  };
  return {
    say,
    mine,
    mode,
    setMode,
    file,
    url,
    caption,
    setCaption,
    error,
    busy,
    setBusy,
    progress,
    locked,
    ready,
    select,
    publish,
    cancelPending: () => controller.current?.abort(),
  };
}
