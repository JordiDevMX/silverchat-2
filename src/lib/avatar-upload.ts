import imageCompression from "browser-image-compression";
import type { Area } from "react-easy-crop";
import { supabase } from "./supabase";
export async function optimizeAvatar(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.095,
    maxWidthOrHeight: 512,
    initialQuality: 0.85,
    fileType: "image/webp",
    useWebWorker: true,
  });
  if (compressed.type !== "image/webp" || compressed.size >= 100_000)
    throw new Error("Could not compress this photo below 100 KB. Try another image.");
  return new File([compressed], `avatar-${crypto.randomUUID()}.webp`, { type: "image/webp" });
}
export async function cropAvatar(url: string, area: Area): Promise<File> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image editor unavailable");
  context.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, 512, 512);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Image conversion failed"))),
      "image/webp",
      0.85,
    ),
  );
  return optimizeAvatar(new File([blob], "avatar.webp", { type: "image/webp" }));
}
export async function deleteAvatarFile(userId: string, path: string) {
  if (!path.startsWith(`${userId}/`)) return;
  const removed = await supabase.storage.from("avatars").remove([path]);
  if (removed.error) throw removed.error;
  const metadata = await supabase
    .from("file_uploads")
    .delete()
    .eq("uploader_id", userId)
    .eq("bucket", "avatars")
    .eq("path", path);
  if (metadata.error) throw metadata.error;
}
export async function saveAvatar(
  userId: string,
  file: File | null,
  previous: string | null,
): Promise<{ cleanupPending: boolean }> {
  let path: string | null = null;
  let uploadId: string | null = null;
  try {
    if (file) {
      path = `${userId}/${file.name}`;
      uploadId = crypto.randomUUID();
      const metadata = await supabase.from("file_uploads").insert({
        id: uploadId,
        uploader_id: userId,
        bucket: "avatars",
        path,
        original_filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        width: 512,
        height: 512,
      });
      if (metadata.error) throw metadata.error;
      const uploading = await supabase
        .from("file_uploads")
        .update({ status: "uploading" })
        .eq("id", uploadId);
      if (uploading.error) throw uploading.error;
      const uploaded = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: "image/webp", upsert: false });
      if (uploaded.error) throw uploaded.error;
      const completed = await supabase
        .from("file_uploads")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", uploadId);
      if (completed.error) throw completed.error;
    }
    const profile = await supabase
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", userId)
      .select("id")
      .single();
    if (profile.error) throw profile.error;
  } catch (error) {
    if (path && uploadId) {
      // Best effort; failed cleanup remains attributable to this owner for retry/maintenance.
      await supabase.from("file_uploads").update({ status: "failed" }).eq("id", uploadId);
      await deleteAvatarFile(userId, path).catch(() => undefined);
    }
    throw error;
  }
  if (previous && previous !== path) {
    try {
      await deleteAvatarFile(userId, previous);
    } catch {
      return { cleanupPending: true };
    }
  }
  return { cleanupPending: false };
}
