import { uploadToStorage } from "@/features/messages/lib/upload";
import { supabase } from "@/lib/supabase";
export async function saveGroupAvatar(
  chatId: string,
  userId: string,
  file: File | null,
  previous: string | null,
  save: (patch: { avatar_url: string }) => Promise<void>,
  kind: "group" | "channel" = "group",
) {
  let path: string | null = null;
  let id: string | null = null;
  if (file) {
    path = `chat-${chatId}/${kind}-${Date.now()}-${crypto.randomUUID()}.webp`;
    id = crypto.randomUUID();
    const meta = await supabase.from("file_uploads").insert({
      id,
      uploader_id: userId,
      bucket: "avatars",
      path,
      original_filename: file.name,
      mime_type: "image/webp",
      size_bytes: file.size,
      width: 512,
      height: 512,
    });
    if (meta.error) throw meta.error;
    try {
      await uploadToStorage("avatars", path, file, () => {}, new AbortController().signal);
      const done = await supabase
        .from("file_uploads")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", id);
      if (done.error) throw done.error;
    } catch (error) {
      await supabase.storage.from("avatars").remove([path]);
      await supabase.from("file_uploads").delete().eq("id", id);
      throw error;
    }
  }
  try {
    await save({ avatar_url: path ?? "" });
  } catch (error) {
    const current = await supabase
      .from(kind === "channel" ? "channels" : "chats")
      .select("avatar_url")
      .eq("id", chatId)
      .maybeSingle();
    if (!current.error && current.data?.avatar_url === (path ?? null))
      return { cleanupPending: !!previous };
    if (!current.error && current.data && path && id) {
      await supabase.storage.from("avatars").remove([path]);
      await supabase.from("file_uploads").delete().eq("id", id);
    }
    throw error;
  }
  let cleanupPending = false;
  if (previous && previous !== path && previous.startsWith(`chat-${chatId}/`)) {
    const old = await supabase
      .from("file_uploads")
      .select("id,uploader_id")
      .eq("bucket", "avatars")
      .eq("path", previous)
      .maybeSingle();
    if (old.data?.uploader_id === userId) {
      const removed = await supabase.storage.from("avatars").remove([previous]);
      if (!removed.error) {
        const deleted = await supabase.from("file_uploads").delete().eq("id", old.data.id);
        cleanupPending = !!deleted.error;
      } else cleanupPending = true;
    } else cleanupPending = true;
  }
  return { cleanupPending };
}
