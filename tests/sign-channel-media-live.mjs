// Live Staging contract verification for the `sign-channel-media` Edge Function.
// Strictly binds normalized origin to Staging `gffdrrtatxdiucigtwdn` before key lookup.
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  createStagingTestUser,
  resolveAuthorizedStagingConfig,
  StagingCleanupVerifier,
} from "./lib/staging-live.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { url, anonKey, serviceKey } = resolveAuthorizedStagingConfig(rootDir);
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function callSign(token, body) {
  const res = await fetch(`${url}/functions/v1/sign-channel-media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

let uOwner;
let uViewer;
let uOutsider;
let chId;
let grpId;
let uploadId;
const registeredUserIds = [];
const cleanupObjects = [];
const createdBuckets = [];
let primaryPassed = false;
const cleanup = new StagingCleanupVerifier();

const makeUser = (tag) =>
  createStagingTestUser({
    url,
    anonKey,
    admin,
    prefix: "srp-edge",
    tag,
    registeredUserIds,
    createClientFn: createClient,
  });

try {
  for (const bucketName of ["avatars", "channel-media"]) {
    const existing = await admin.storage.getBucket(bucketName);
    if (existing.error) {
      const created = await admin.storage.createBucket(bucketName, { public: false });
      if (created.error) throw created.error;
      createdBuckets.push(bucketName);
    }
  }
  uOwner = await makeUser("owner");
  uViewer = await makeUser("viewer");
  uOutsider = await makeUser("outsider");

  const unauth = await callSign(null, { kind: "channel_avatar" });
  assert.equal(unauth.status, 401, "Unauthenticated request must return 401");

  const slug = `edge-test-${Date.now()}`;
  const chRes = await uOwner.client.rpc("create_channel", {
    p_name: "Edge Sign Test",
    p_slug: slug,
    p_description: "Test",
  });
  assert.ifError(chRes.error);
  chId = chRes.data;

  const avatarPath = `chat-${chId}/channel-live.webp`;
  const tinyBytes = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]);
  const avUp = await admin.storage
    .from("avatars")
    .upload(avatarPath, tinyBytes, { contentType: "image/webp", upsert: true });
  assert.ifError(avUp.error);
  cleanupObjects.push(["avatars", avatarPath]);

  const infoRes = await uOwner.client.rpc("update_channel_info", {
    p_channel_id: chId,
    p_avatar_url: avatarPath,
  });
  assert.ifError(infoRes.error);

  const mediaPath = `${chId}/post-live.webp`;
  const mUp = await admin.storage
    .from("channel-media")
    .upload(mediaPath, tinyBytes, { contentType: "image/webp", upsert: true });
  assert.ifError(mUp.error);
  cleanupObjects.push(["channel-media", mediaPath]);

  const upRes = await admin
    .from("file_uploads")
    .insert({
      uploader_id: uOwner.user.id,
      bucket: "channel-media",
      path: mediaPath,
      original_filename: "post-live.webp",
      mime_type: "image/webp",
      size_bytes: tinyBytes.length,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  assert.ifError(upRes.error);
  uploadId = upRes.data.id;

  const postRes = await admin
    .from("messages")
    .insert({
      channel_id: chId,
      sender_id: uOwner.user.id,
      type: "image",
      file_upload_id: uploadId,
      content: "Image post",
    })
    .select("id")
    .single();
  assert.ifError(postRes.error);

  const grpRes = await uOwner.client.rpc("create_group_chat", {
    p_name: "Fwd Group",
    p_member_ids: [uViewer.user.id],
  });
  assert.ifError(grpRes.error);
  grpId = grpRes.data;

  const fwdMsgId = crypto.randomUUID();
  const fwdRes = await uOwner.client.rpc("forward_chat_message", {
    p_message_id: postRes.data.id,
    p_chat_ids: [grpId],
    p_message_ids: [fwdMsgId],
  });
  assert.ifError(fwdRes.error);

  const avOk = await callSign(uViewer.token, {
    kind: "channel_avatar",
    channelId: chId,
    path: avatarPath,
  });
  assert.equal(avOk.status, 200, "Viewer channel avatar sign must return 200");
  assert((await fetch(avOk.data.signedUrl)).ok, "Signed channel avatar URL must fetch 200");

  const avStale = await callSign(uViewer.token, {
    kind: "channel_avatar",
    channelId: chId,
    path: `chat-${chId}/channel-old.webp`,
  });
  assert.equal(avStale.status, 403, "Stale channel avatar path must return 403");

  const postOk = await callSign(uViewer.token, {
    kind: "channel_post_media",
    uploadId,
    channelId: chId,
    download: false,
  });
  assert.equal(postOk.status, 200, "Viewer channel post media sign must return 200");
  assert((await fetch(postOk.data.signedUrl)).ok, "Signed channel post media URL must fetch 200");

  const fwdDenied = await callSign(uOutsider.token, {
    kind: "forwarded_channel_media",
    uploadId,
    messageId: fwdMsgId,
  });
  assert.equal(fwdDenied.status, 403, "Outsider cannot sign forwarded channel media");

  const fwdOkBefore = await callSign(uViewer.token, {
    kind: "forwarded_channel_media",
    uploadId,
    messageId: fwdMsgId,
    download: true,
    filename: "post-live.webp",
  });
  assert.equal(fwdOkBefore.status, 200, "Destination chat member can sign forwarded media");

  const delRes = await uOwner.client.rpc("delete_channel_post", {
    p_message_id: postRes.data.id,
  });
  assert.ifError(delRes.error);

  const postAfterDel = await callSign(uOutsider.token, {
    kind: "channel_post_media",
    uploadId,
    channelId: chId,
  });
  assert.equal(postAfterDel.status, 403, "Deleted channel post media denied (403)");

  const fwdAfterDel = await callSign(uViewer.token, {
    kind: "forwarded_channel_media",
    uploadId,
    messageId: fwdMsgId,
  });
  assert.equal(
    fwdAfterDel.status,
    200,
    "Forwarded copy stays accessible after source channel post delete",
  );

  primaryPassed = true;
} finally {
  if (chId && uOwner) {
    await cleanup.runStep("delete_channel", () =>
      uOwner.client.rpc("delete_channel", { p_channel_id: chId }),
    );
  }
  if (grpId) {
    await cleanup.runStep("delete_chat", () => admin.from("chats").delete().eq("id", grpId));
  }
  if (uploadId) {
    await cleanup.runStep("delete_file_upload", () =>
      admin.from("file_uploads").delete().eq("id", uploadId),
    );
  }
  for (const [bucket, objPath] of cleanupObjects) {
    await cleanup.runStep(`storage_remove:${bucket}/${objPath}`, () =>
      admin.storage.from(bucket).remove([objPath]),
    );
  }
  for (const bucket of createdBuckets) {
    await cleanup.runStep(`storage_delete_bucket:${bucket}`, () =>
      admin.storage.deleteBucket(bucket),
    );
  }
  for (const uid of registeredUserIds) {
    await cleanup.runStep(`delete_user:${uid}`, () => admin.auth.admin.deleteUser(uid));
  }

  await cleanup.verifyRowAbsent(admin, "channels", chId, "channels");
  await cleanup.verifyRowAbsent(admin, "chats", grpId, "chats");
  await cleanup.verifyRowAbsent(admin, "file_uploads", uploadId, "uploads");
  for (const [bucket, objPath] of cleanupObjects) {
    await cleanup.verifyObjectAbsent(admin, bucket, objPath);
  }
  for (const bucket of createdBuckets) {
    await cleanup.verifyBucketAbsent(admin, bucket);
  }
  for (const uid of registeredUserIds) {
    await cleanup.verifyUserAbsent(admin, uid);
  }

  try {
    const summary = cleanup.emitSummary({
      suite: "sign-channel-media-live",
      origin: url,
      passed: primaryPassed,
      metrics: { checksVerified: 8 },
    });
    if (summary.passed) {
      console.log("ALL STAGING EDGE SIGNING CONTRACT CHECKS PASSED!");
    }
  } catch (cleanupErr) {
    console.error(cleanupErr);
    process.exitCode = 1;
  }
}
