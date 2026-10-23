import imageCompression from "browser-image-compression";
import { getAccessToken, refreshAccessToken } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Upload } from "../types";
import { videoThumbnail } from "./videoThumbnail";
export function safeFilename(name: string) {
  return (
    name
      .normalize("NFKC")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/^\.+/, "")
      .slice(-120) || "attachment"
  );
}
export async function uploadToStorage(
  bucket: string,
  path: string,
  file: File,
  onProgress: (percent: number) => void,
  signal: AbortSignal,
) {
  const token = getAccessToken() ?? (await refreshAccessToken());
  if (!token) throw new Error("Please sign in again");
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const done = (error?: Error) => {
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    };
    xhr.open(
      "POST",
      `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`,
    );
    xhr.timeout = 300000;
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      done(
        xhr.status >= 200 && xhr.status < 300
          ? undefined
          : new Error(`Upload failed (${xhr.status})`),
      );
    xhr.onerror = () => done(new Error("Upload connection failed"));
    xhr.ontimeout = () => done(new Error("Upload timed out"));
    xhr.onabort = () => done(new DOMException("Upload cancelled", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      done(new DOMException("Upload cancelled", "AbortError"));
      return;
    }
    xhr.send(file);
  });
}
export async function cleanupUploads(uploads: Upload[]) {
  for (const upload of uploads) {
    // The policies also reject removal if a send committed before its response failed.
    const referenced = await supabase.rpc("own_upload_is_referenced", { p_upload_id: upload.id });
    if (referenced.error || referenced.data) continue;
    const removed = await supabase.storage.from(upload.bucket).remove([upload.path]);
    if (!removed.error) await supabase.from("file_uploads").delete().eq("id", upload.id);
  }
}
export async function prepareAndUpload(
  file: File,
  chatId: string,
  userId: string,
  signal: AbortSignal,
  onProgress: (percent: number) => void,
  options?: {
    durationSeconds?: number;
    bucket?: "chat-media" | "channel-media" | "story-media";
    maxVideoSeconds?: number;
  },
) {
  const tracked: Upload[] = [];
  const bucket = options?.bucket ?? "chat-media";
  try {
    let main = file;
    let width: number | undefined;
    let height: number | undefined;
    let duration: number | undefined =
      options?.durationSeconds === undefined
        ? undefined
        : Math.max(1, Math.ceil(options.durationSeconds));
    let thumb: File | undefined;
    const type = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
          ? "audio"
          : "file";
    if (type === "image") {
      main = await imageCompression(file, {
        maxWidthOrHeight: 2048,
        maxSizeMB: 0.19,
        initialQuality: 0.82,
        fileType: "image/webp",
        useWebWorker: true,
        signal,
      });
      if (main.size >= 200000) throw new Error("Image could not be compressed below 200 KB");
      const bitmap = await createImageBitmap(main);
      width = bitmap.width;
      height = bitmap.height;
      bitmap.close();
      main = new File([main], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
    } else if (type === "video") {
      const preview = await videoThumbnail(file, signal);
      width = preview.width;
      height = preview.height;
      duration = Math.ceil(preview.duration);
      if (options?.maxVideoSeconds && preview.duration > options.maxVideoSeconds)
        throw new Error(`Video must be at most ${options.maxVideoSeconds} seconds`);
      thumb = preview.file;
    }
    signal.throwIfAborted();
    const uploadOne = async (blob: File, thumbnail: boolean) => {
      const id = crypto.randomUUID();
      const path = `${chatId}/${id}/${safeFilename(blob.name)}`;
      // Hashing huge video files would duplicate them in memory; skip the optional hash.
      const hash =
        blob.size <= 20 * 1024 * 1024
          ? [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))]
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("")
          : null;
      signal.throwIfAborted();
      const inserted = await supabase
        .from("file_uploads")
        .insert({
          id,
          uploader_id: userId,
          bucket,
          path,
          original_filename: blob.name,
          mime_type: blob.type || "application/octet-stream",
          size_bytes: blob.size,
          width: thumbnail ? undefined : width,
          height: thumbnail ? undefined : height,
          duration_seconds: thumbnail ? undefined : duration,
          hash_sha256: hash,
        })
        .select("*")
        .single();
      if (inserted.error) throw inserted.error;
      tracked.push(inserted.data);
      signal.throwIfAborted();
      const uploading = await supabase
        .from("file_uploads")
        .update({ status: "uploading" })
        .eq("id", id);
      if (uploading.error) throw uploading.error;
      await uploadToStorage(
        bucket,
        path,
        blob,
        (p) => onProgress(thumb ? (thumbnail ? 90 + p * 0.1 : p * 0.9) : p),
        signal,
      );
      signal.throwIfAborted();
      const completed = await supabase
        .from("file_uploads")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
      if (completed.error) throw completed.error;
      return completed.data;
    };
    const upload = await uploadOne(main, false);
    const thumbnail = thumb ? await uploadOne(thumb, true) : undefined;
    signal.throwIfAborted();
    return { type, upload, thumbnail } as const;
  } catch (error) {
    await cleanupUploads(tracked);
    throw error;
  }
}
