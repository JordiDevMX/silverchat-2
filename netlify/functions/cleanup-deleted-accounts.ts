import type { Config } from "@netlify/functions";
import { adminClient } from "./_lib/supabase-admin.ts";

// Netlify scheduled functions are platform-invoked, not public HTTP endpoints.
// Never expose this handler through an API redirect. Test only with disposable local accounts.
export default async function handler() {
  const admin = adminClient();
  const cutoff = new Date().toISOString();
  let deleted = 0;
  let failed = 0;
  let total = 0;
  let cursor = "";
  try {
    // Cursor pagination prevents deleting page one from shifting later rows out of view.
    for (;;) {
      let query = admin
        .from("profiles")
        .select("id,scheduled_deletion_at")
        .lt("scheduled_deletion_at", cutoff)
        .order("id")
        .limit(100);
      if (cursor) query = query.gt("id", cursor);
      const expired = await query;
      if (expired.error) throw expired.error;
      if (!expired.data.length) break;
      for (const profile of expired.data) {
        cursor = profile.id;
        total++;
        try {
          // Cancellation after the batch was selected must be respected.
          const current = await admin
            .from("profiles")
            .select("scheduled_deletion_at")
            .eq("id", profile.id)
            .maybeSingle();
          if (current.error) throw current.error;
          if (!current.data?.scheduled_deletion_at || current.data.scheduled_deletion_at >= cutoff)
            continue;
          // Storage objects are not removed by the auth cascade and can prevent auth deletion.
          // Metadata stays until auth deletion succeeds, so failed attempts can retry safely.
          for (let offset = 0; ; offset += 500) {
            const uploads = await admin
              .from("file_uploads")
              .select("bucket,path")
              .eq("uploader_id", profile.id)
              .order("id")
              .range(offset, offset + 499);
            if (uploads.error) throw uploads.error;
            for (const bucket of ["avatars", "chat-media", "story-media", "channel-media"]) {
              const paths = uploads.data
                .filter((file) => file.bucket === bucket)
                .map((file) => file.path);
              if (paths.length) {
                const removed = await admin.storage.from(bucket).remove(paths);
                if (removed.error) throw removed.error;
              }
            }
            if (uploads.data.length < 500) break;
          }
          const recheck = await admin
            .from("profiles")
            .select("scheduled_deletion_at")
            .eq("id", profile.id)
            .maybeSingle();
          if (recheck.error) throw recheck.error;
          if (!recheck.data?.scheduled_deletion_at || recheck.data.scheduled_deletion_at >= cutoff)
            continue;
          const result = await admin.auth.admin.deleteUser(profile.id);
          if (result.error) throw result.error;
          deleted++;
        } catch {
          failed++;
        }
      }
    }
    console.log("Account cleanup completed", { total, deleted, failed });
    return Response.json({ total, deleted, failed }, { status: failed ? 500 : 200 });
  } catch {
    console.error("Account cleanup unavailable", { total, deleted, failed });
    return Response.json({ error: "cleanup_failed", total, deleted, failed }, { status: 500 });
  }
}
export const config: Config = { schedule: "0 4 * * *" };
