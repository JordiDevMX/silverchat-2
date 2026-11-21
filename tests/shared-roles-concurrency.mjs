// Live Staging multi-session concurrency verification for shared roles & permissions.
// Requires linked Staging target `gffdrrtatxdiucigtwdn` (`db-guard.mjs` enforced).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ref = process.env.SUPABASE_PROJECT_REF ?? "gffdrrtatxdiucigtwdn";
const url = process.env.SUPABASE_URL ?? `https://${ref}.supabase.co`;

execFileSync("node", [path.join(rootDir, "scripts", "db-guard.mjs"), "--expect", ref], {
  cwd: rootDir,
  stdio: "inherit",
});

const keys = JSON.parse(
  execFileSync(
    "npx",
    ["supabase", "--workdir", rootDir, "projects", "api-keys", "--project-ref", ref, "-o", "json"],
    { encoding: "utf8", shell: true },
  ),
);
const anonKey = keys.find((k) => k.id === "anon")?.api_key;
const serviceKey = keys.find((k) => k.id === "service_role")?.api_key;
assert(anonKey && serviceKey, "Missing Staging API keys");

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

let uOwner;
let uAdmin;
let uMod;
let uMember;
let chId;
let commId;
let grpId;
let srcGroupId;

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

  // 2. Concurrent channel staff appoint + follow + OC-02 follower_count invariant
  await Promise.all([
    uOwner.client.rpc("appoint_channel_admin", { p_channel_id: chId, p_user_id: uAdmin.user.id }),
    uAdmin.client.rpc("follow_channel", { p_channel_id: chId }),
    uMember.client.rpc("follow_channel", { p_channel_id: chId }),
  ]);
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

  // Community setup
  const commRes = await uOwner.client.rpc("create_community", {
    p_name: "Conc Community",
    p_description: "Serialization test",
  });
  assert.ifError(commRes.error);
  commId = commRes.data;

  await Promise.all([
    uOwner.client.rpc("join_community", { p_community_id: commId, p_user_id: uAdmin.user.id }),
    uOwner.client.rpc("join_community", { p_community_id: commId, p_user_id: uMod.user.id }),
    uOwner.client.rpc("join_community", { p_community_id: commId, p_user_id: uMember.user.id }),
  ]);
  await uOwner.client.rpc("promote_community_admin", {
    p_community_id: commId,
    p_user_id: uAdmin.user.id,
  });
  await uOwner.client.rpc("appoint_community_moderator", {
    p_community_id: commId,
    p_user_id: uMod.user.id,
  });
  await uOwner.client.rpc("set_announcement_writer", {
    p_community_id: commId,
    p_user_id: uMod.user.id,
    p_grant: true,
  });

  const { data: commChats, error: chatsErr } = await uMod.client
    .from("chats")
    .select("id,name,system_role")
    .eq("community_id", commId);
  assert.ifError(chatsErr);
  const genChat = commChats.find((c) => c.name === "General");
  const avisosChat = commChats.find((c) => c.system_role === "announcements");
  assert(genChat && avisosChat, "Expected General and official announcements chats");

  // 3. Concurrent announcement grant withdrawal vs moderator send & forward in Avisos
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
  assert.ifError(revokeRes.error);
  if (modSendRes.error) assert.equal(modSendRes.error.code, "42501");
  if (modFwdRes.error) assert.equal(modFwdRes.error.code, "42501");

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
  assert(afterRevokeSend.error, "Post-withdrawal moderator send to announcements must fail");
  assert(afterRevokeFwd.error, "Post-withdrawal moderator forward to announcements must fail");

  // 4. Concurrent silence_community_member vs member send AND forward_chat_message serialization
  const silenceUntil = new Date(Date.now() + 60_000).toISOString();
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
  assert.ifError(silRes.error);
  if (memSendRes.error) assert.equal(memSendRes.error.code, "42501");
  if (memFwdRes.error) assert.equal(memFwdRes.error.code, "42501");

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
  assert(afterSilSend.error, "Send strictly after silence must reject");
  assert(afterSilFwd.error, "Forward strictly after silence must reject");

  // 5. OC-01 Concurrent group admin demote race
  const grpRes = await uOwner.client.rpc("create_group_chat", {
    p_name: "Conc Group",
    p_member_ids: [uAdmin.user.id, uMember.user.id],
  });
  assert.ifError(grpRes.error);
  grpId = grpRes.data;
  await uOwner.client.rpc("promote_chat_admin", { p_chat_id: grpId, p_user_id: uAdmin.user.id });
  await uOwner.client.rpc("promote_chat_admin", { p_chat_id: grpId, p_user_id: uMember.user.id });

  const [adminVsMember, memberVsAdmin] = await Promise.all([
    uAdmin.client.rpc("demote_chat_admin", { p_chat_id: grpId, p_user_id: uMember.user.id }),
    uMember.client.rpc("demote_chat_admin", { p_chat_id: grpId, p_user_id: uAdmin.user.id }),
  ]);
  assert(
    adminVsMember.error,
    "Non-owner admin cannot demote another admin in concurrent race (OC-01)",
  );
  assert(
    memberVsAdmin.error,
    "Non-owner admin cannot demote peer admin in concurrent race (OC-01)",
  );

  const ownerDemote = await uOwner.client.rpc("demote_chat_admin", {
    p_chat_id: grpId,
    p_user_id: uMember.user.id,
  });
  assert.ifError(ownerDemote.error);

  console.log("ALL STAGING TWO-SESSION CONCURRENCY CHECKS PASSED!");
} finally {
  const safe = async (fn) => {
    try {
      await fn();
    } catch {}
  };
  if (chId && uOwner) await safe(() => uOwner.client.rpc("delete_channel", { p_channel_id: chId }));
  if (commId && uOwner) {
    await safe(() => uOwner.client.rpc("delete_community", { p_community_id: commId }));
  }
  if (grpId) await safe(() => admin.from("chats").delete().eq("id", grpId));
  if (srcGroupId) await safe(() => admin.from("chats").delete().eq("id", srcGroupId));
  for (const u of [uOwner, uAdmin, uMod, uMember]) {
    if (u?.user?.id) await safe(() => admin.auth.admin.deleteUser(u.user.id));
  }
}
