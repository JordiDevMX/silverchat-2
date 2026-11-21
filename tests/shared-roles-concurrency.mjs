// Live Staging multi-session concurrency & transaction-serialization verification.
// Strictly binds normalized origin to Staging `gffdrrtatxdiucigtwdn` before key lookup.
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { resolveAuthorizedStagingConfig, StagingCleanupVerifier } from "./lib/staging-live.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { url, anonKey, serviceKey } = resolveAuthorizedStagingConfig(rootDir);
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function makeUser(tag) {
  const email = `srp-conc-${tag}-${Date.now()}@example.test`;
  const password = `Srp!${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username: `conc_${tag}_${Date.now().toString().slice(-4)}`,
      display_name: tag,
    },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) throw signIn.error ?? new Error("signIn failed");
  return { user: data.user, client };
}

function outcomeTag(res) {
  if (!res.error) return "ok";
  return `err:${res.error.code ?? "unknown"}`;
}

let uOwner;
let uAdmin;
let uMod;
let uMember;
let chId;
let commId;
let grpId;
let srcGroupId;
let primaryPassed = false;
const raceObservations = {};
const cleanup = new StagingCleanupVerifier();

try {
  uOwner = await makeUser("owner");
  uAdmin = await makeUser("admin");
  uMod = await makeUser("mod");
  uMember = await makeUser("member");

  // 1. Concurrent idempotent create_channel retry with the same client UUID
  const chDraftId = crypto.randomUUID();
  const slug = `conc-ch-${Date.now()}`;
  const [c1, c2] = await Promise.all([
    uOwner.client.rpc("create_channel", {
      p_channel_id: chDraftId,
      p_name: "Conc News",
      p_slug: slug,
      p_description: "Concurrency",
    }),
    uOwner.client.rpc("create_channel", {
      p_channel_id: chDraftId,
      p_name: "Conc News",
      p_slug: slug,
      p_description: "Concurrency",
    }),
  ]);
  const chOk = [c1, c2].filter((r) => !r.error);
  assert(chOk.length >= 1, "At least one concurrent create_channel must succeed");
  for (const r of chOk) assert.equal(r.data, chDraftId);
  chId = chDraftId;
  raceObservations.createChannel = [outcomeTag(c1), outcomeTag(c2)];

  // 2. Concurrent channel staff appoint + follow + OC-02 follower_count invariant
  const chRace = await Promise.all([
    uOwner.client.rpc("appoint_channel_admin", { p_channel_id: chId, p_user_id: uAdmin.user.id }),
    uAdmin.client.rpc("follow_channel", { p_channel_id: chId }),
    uMember.client.rpc("follow_channel", { p_channel_id: chId }),
  ]);
  for (const r of chRace) assert.ifError(r.error);
  const chRead = await uMember.client
    .from("channels_public")
    .select("follower_count")
    .eq("id", chId)
    .single();
  assert.ifError(chRead.error);
  assert.equal(
    chRead.data.follower_count,
    3,
    "Owner + admin + member counted once each under concurrency",
  );

  // Source message owned by uMember & uMod (in a separate group) so forward_chat_message can race cleanly
  const srcGrpRes = await uMember.client.rpc("create_group_chat", {
    p_name: "Forward Source",
    p_member_ids: [uMod.user.id],
  });
  assert.ifError(srcGrpRes.error);
  srcGroupId = srcGrpRes.data;
  const seedMsg = await uMember.client
    .from("messages")
    .insert({ chat_id: srcGroupId, sender_id: uMember.user.id, content: "Forward seed" })
    .select("id")
    .single();
  assert.ifError(seedMsg.error);

  // Community setup (every RPC asserted explicitly)
  const commRes = await uOwner.client.rpc("create_community", {
    p_name: "Conc Community",
    p_description: "Serialization test",
  });
  assert.ifError(commRes.error);
  commId = commRes.data;

  const joins = await Promise.all([
    uOwner.client.rpc("join_community", { p_community_id: commId, p_user_id: uAdmin.user.id }),
    uOwner.client.rpc("join_community", { p_community_id: commId, p_user_id: uMod.user.id }),
    uOwner.client.rpc("join_community", { p_community_id: commId, p_user_id: uMember.user.id }),
  ]);
  for (const j of joins) assert.ifError(j.error);

  const promAdmin = await uOwner.client.rpc("promote_community_admin", {
    p_community_id: commId,
    p_user_id: uAdmin.user.id,
  });
  assert.ifError(promAdmin.error);
  const appMod = await uOwner.client.rpc("appoint_community_moderator", {
    p_community_id: commId,
    p_user_id: uMod.user.id,
  });
  assert.ifError(appMod.error);
  const grantRes = await uOwner.client.rpc("set_announcement_writer", {
    p_community_id: commId,
    p_user_id: uMod.user.id,
    p_grant: true,
  });
  assert.ifError(grantRes.error);

  const { data: commChats, error: chatsErr } = await uMod.client
    .from("chats")
    .select("id,name,system_role")
    .eq("community_id", commId);
  assert.ifError(chatsErr);
  const genChat = commChats.find((c) => c.name === "General");
  const avisosChat = commChats.find((c) => c.system_role === "announcements");
  assert(genChat && avisosChat, "Expected General and official announcements chats");

  // 3a. Demonstrate permitted baseline send AND forward by granted moderator BEFORE revocation
  const baseModSend = await uMod.client.from("messages").insert({
    chat_id: avisosChat.id,
    sender_id: uMod.user.id,
    content: "Baseline granted announcement send",
  });
  assert.ifError(baseModSend.error);
  const baseModFwd = await uMod.client.rpc("forward_chat_message", {
    p_message_id: seedMsg.data.id,
    p_chat_ids: [avisosChat.id],
    p_message_ids: [crypto.randomUUID()],
  });
  assert.ifError(baseModFwd.error);

  // 3b. Concurrent HTTP/RPC requests: owner revokes writer grant while moderator sends & forwards
  // Note: Promise.all issues overlapping client requests; Postgres row-level serialization in
  // serialize_chat_message_write determines whether each concurrent write commits before revocation
  // ("ok") or strictly after ("err:42501"), while every post-commit write MUST fail with 42501.
  const tRevokeStart = performance.now();
  const [revokeRes, modSendRes, modFwdRes] = await Promise.all([
    uOwner.client.rpc("set_announcement_writer", {
      p_community_id: commId,
      p_user_id: uMod.user.id,
      p_grant: false,
    }),
    uMod.client.from("messages").insert({
      chat_id: avisosChat.id,
      sender_id: uMod.user.id,
      content: "Concurrent announcement send",
    }),
    uMod.client.rpc("forward_chat_message", {
      p_message_id: seedMsg.data.id,
      p_chat_ids: [avisosChat.id],
      p_message_ids: [crypto.randomUUID()],
    }),
  ]);
  const tRevokeMs = Math.round(performance.now() - tRevokeStart);
  assert.ifError(revokeRes.error);
  if (modSendRes.error) assert.equal(modSendRes.error.code, "42501");
  if (modFwdRes.error) assert.equal(modFwdRes.error.code, "42501");
  raceObservations.announcementWithdrawal = {
    concurrentDispatchMs: tRevokeMs,
    revoke: outcomeTag(revokeRes),
    concurrentSend: outcomeTag(modSendRes),
    concurrentForward: outcomeTag(modFwdRes),
  };

  // 3c. Post-revocation barrier: both send and forward MUST return 42501
  const afterRevokeSend = await uMod.client.from("messages").insert({
    chat_id: avisosChat.id,
    sender_id: uMod.user.id,
    content: "Blocked after withdrawal",
  });
  const afterRevokeFwd = await uMod.client.rpc("forward_chat_message", {
    p_message_id: seedMsg.data.id,
    p_chat_ids: [avisosChat.id],
    p_message_ids: [crypto.randomUUID()],
  });
  assert.equal(afterRevokeSend.error?.code, "42501", "Post-withdrawal send must reject with 42501");
  assert.equal(
    afterRevokeFwd.error?.code,
    "42501",
    "Post-withdrawal forward must reject with 42501",
  );

  // 4a. Demonstrate permitted baseline send AND forward by active member BEFORE silence
  const baseMemSend = await uMember.client.from("messages").insert({
    chat_id: genChat.id,
    sender_id: uMember.user.id,
    content: "Baseline member send before silence",
  });
  assert.ifError(baseMemSend.error);
  const baseMemFwd = await uMember.client.rpc("forward_chat_message", {
    p_message_id: seedMsg.data.id,
    p_chat_ids: [genChat.id],
    p_message_ids: [crypto.randomUUID()],
  });
  assert.ifError(baseMemFwd.error);

  // 4b. Concurrent HTTP/RPC requests: owner silences member while member sends & forwards
  const silenceUntil = new Date(Date.now() + 60_000).toISOString();
  const tSilStart = performance.now();
  const [silRes, memSendRes, memFwdRes] = await Promise.all([
    uOwner.client.rpc("silence_community_member", {
      p_community_id: commId,
      p_user_id: uMember.user.id,
      p_silenced_until: silenceUntil,
      p_reason: "Concurrency check",
    }),
    uMember.client.from("messages").insert({
      chat_id: genChat.id,
      sender_id: uMember.user.id,
      content: "Concurrent race message",
    }),
    uMember.client.rpc("forward_chat_message", {
      p_message_id: seedMsg.data.id,
      p_chat_ids: [genChat.id],
      p_message_ids: [crypto.randomUUID()],
    }),
  ]);
  const tSilMs = Math.round(performance.now() - tSilStart);
  assert.ifError(silRes.error);
  if (memSendRes.error) assert.equal(memSendRes.error.code, "42501");
  if (memFwdRes.error) assert.equal(memFwdRes.error.code, "42501");
  raceObservations.communitySilence = {
    concurrentDispatchMs: tSilMs,
    silence: outcomeTag(silRes),
    concurrentSend: outcomeTag(memSendRes),
    concurrentForward: outcomeTag(memFwdRes),
  };

  // 4c. Post-silence barrier: both send and forward MUST return 42501
  const afterSilSend = await uMember.client.from("messages").insert({
    chat_id: genChat.id,
    sender_id: uMember.user.id,
    content: "Blocked after silence",
  });
  const afterSilFwd = await uMember.client.rpc("forward_chat_message", {
    p_message_id: seedMsg.data.id,
    p_chat_ids: [genChat.id],
    p_message_ids: [crypto.randomUUID()],
  });
  assert.equal(afterSilSend.error?.code, "42501", "Post-silence send must reject with 42501");
  assert.equal(afterSilFwd.error?.code, "42501", "Post-silence forward must reject with 42501");

  // 5. OC-01 Concurrent group admin demote race
  const grpRes = await uOwner.client.rpc("create_group_chat", {
    p_name: "Conc Group",
    p_member_ids: [uAdmin.user.id, uMember.user.id],
  });
  assert.ifError(grpRes.error);
  grpId = grpRes.data;
  const p1 = await uOwner.client.rpc("promote_chat_admin", {
    p_chat_id: grpId,
    p_user_id: uAdmin.user.id,
  });
  assert.ifError(p1.error);
  const p2 = await uOwner.client.rpc("promote_chat_admin", {
    p_chat_id: grpId,
    p_user_id: uMember.user.id,
  });
  assert.ifError(p2.error);

  const [adminVsMember, memberVsAdmin] = await Promise.all([
    uAdmin.client.rpc("demote_chat_admin", { p_chat_id: grpId, p_user_id: uMember.user.id }),
    uMember.client.rpc("demote_chat_admin", { p_chat_id: grpId, p_user_id: uAdmin.user.id }),
  ]);
  assert.equal(
    adminVsMember.error?.code,
    "42501",
    "Non-owner admin cannot demote peer admin in concurrent race (OC-01)",
  );
  assert.equal(
    memberVsAdmin.error?.code,
    "42501",
    "Non-owner admin cannot demote peer admin in concurrent race (OC-01)",
  );

  const ownerDemote = await uOwner.client.rpc("demote_chat_admin", {
    p_chat_id: grpId,
    p_user_id: uMember.user.id,
  });
  assert.ifError(ownerDemote.error);

  primaryPassed = true;
  console.log("ALL STAGING TWO-SESSION CONCURRENCY CHECKS PASSED!");
} finally {
  if (chId && uOwner) {
    await cleanup.runStep("delete_channel", () =>
      uOwner.client.rpc("delete_channel", { p_channel_id: chId }),
    );
  }
  if (commId && uOwner) {
    await cleanup.runStep("delete_community", () =>
      uOwner.client.rpc("delete_community", { p_community_id: commId }),
    );
  }
  if (grpId) {
    await cleanup.runStep("delete_group", () => admin.from("chats").delete().eq("id", grpId));
  }
  if (srcGroupId) {
    await cleanup.runStep("delete_src_group", () =>
      admin.from("chats").delete().eq("id", srcGroupId),
    );
  }
  for (const u of [uOwner, uAdmin, uMod, uMember]) {
    if (u?.user?.id) {
      await cleanup.runStep(`delete_user:${u.user.id}`, () =>
        admin.auth.admin.deleteUser(u.user.id),
      );
    }
  }

  await cleanup.verifyRowAbsent(admin, "channels", chId, "channels");
  await cleanup.verifyRowAbsent(admin, "communities", commId, "communities");
  await cleanup.verifyRowAbsent(admin, "chats", grpId, "chats");
  await cleanup.verifyRowAbsent(admin, "chats", srcGroupId, "chats");
  for (const u of [uOwner, uAdmin, uMod, uMember]) {
    if (u?.user?.id) await cleanup.verifyUserAbsent(admin, u.user.id);
  }

  try {
    cleanup.emitSummary({
      suite: "shared-roles-concurrency",
      origin: url,
      passed: primaryPassed,
      metrics: raceObservations,
    });
  } catch (cleanupErr) {
    console.error(cleanupErr);
    process.exitCode = 1;
  }
}
