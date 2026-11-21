// Live Staging multi-session concurrency & transaction-serialization verification.
// Strictly binds normalized origin to Staging `gffdrrtatxdiucigtwdn` before key lookup.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  createStagingTestUser,
  resolveAuthorizedStagingConfig,
  runCommunityLockIsolationScenario,
  runConcurrentChannelCreation,
  StagingCleanupVerifier,
} from "./lib/staging-live.mjs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliScript = path.join(rootDir, "node_modules", "supabase", "dist", "supabase.js");
const { url, anonKey, serviceKey } = resolveAuthorizedStagingConfig(rootDir);
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

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
let directChatId;
const registeredUserIds = [];
let primaryPassed = false;
const raceObservations = {};
const cleanup = new StagingCleanupVerifier();

const makeUser = (tag) =>
  createStagingTestUser({
    url,
    anonKey,
    admin,
    prefix: "srp-conc",
    tag,
    registeredUserIds,
    createClientFn: createClient,
  });

try {
  uOwner = await makeUser("owner");
  uAdmin = await makeUser("admin");
  uMod = await makeUser("mod");
  uMember = await makeUser("member");

  // 1. Concurrent idempotent create_channel retry with the same client UUID.
  // Tracks `chId` BEFORE dispatch so partial failures still clean up and verify absence.
  const chDraftId = crypto.randomUUID();
  const slug = `conc-ch-${Date.now()}`;
  const [c1, c2] = await runConcurrentChannelCreation({
    ownerClient: uOwner.client,
    draftId: chDraftId,
    name: "Conc News",
    slug,
    description: "Concurrency",
    onTrackChannelId: (id) => {
      chId = id;
    },
  });
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

  // Direct chat between uMember & uAdmin (accepted) for unrelated direct-send check under community lock
  const directReqRes = await uMember.client.rpc("create_direct_chat_request", {
    p_target_user_id: uAdmin.user.id,
    p_initial_content: "Concurrency direct seed",
  });
  assert.ifError(directReqRes.error);
  directChatId = directReqRes.data;
  const reqRow = await uAdmin.client
    .from("chat_requests")
    .select("id")
    .eq("chat_id", directChatId)
    .single();
  assert.ifError(reqRow.error);
  const acceptRes = await uAdmin.client.rpc("accept_chat_request", {
    p_request_id: reqRow.data.id,
  });
  assert.ifError(acceptRes.error);

  // Community setup (every RPC asserted explicitly)
  const commRes = await uOwner.client.rpc("create_community", {
    p_name: "Conc Community",
    p_description: "Serialization test",
  });
  assert.ifError(commRes.error);
  commId = commRes.data;
  assert(UUID_RE.test(commId), "Expected valid UUID for community");

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

  // 6. Unrelated direct + group sends proceed while a Postgres-observed community row lock
  // blocks a control community insert.
  // Two-barrier database handshake:
  // - Phase 1 (`srcGroupId` in `public.chats` locked inside a subtransaction): the holder polls
  //   `pg_locks` until BOTH the control session (`v_blocked_pid` on `public.communities`) AND
  //   the Phase-1 observer (`v_phase1_pid` on `public.chats`) are blocked by `pg_backend_pid()`,
  //   sets `v_blocked_start := true`, holds `v_phase1_pid` for 550ms, and rolls back only the
  //   inner subtransaction to release `srcGroupId`. Node dispatches the two unrelated sends ONLY
  //   after that `UPDATE` on `srcGroupId` was held >=450ms and released by the holder.
  // - Phase 3 (`chId` in `public.channels` locked in the outer transaction): Node updates `chId`
  //   ONLY after both unrelated sends succeed. The holder waits in `pg_locks` for that waiter
  //   (`v_phase3_pid` on `public.channels`), then immediately verifies `v_blocked_pid` is STILL
  //   blocked by `pg_backend_pid()` (`v_blocked_end := true`) before releasing the lock.
  const lockSql = [
    "CREATE TEMP TABLE _lock_obs (holder_pid int, blocked_pid int, phase1_gate_pid int, phase3_gate_pid int, blocked_at_start boolean, blocked_at_end boolean);",
    "DO $$",
    "DECLARE",
    "  v_blocked_pid int;",
    "  v_phase1_pid int;",
    "  v_phase3_pid int;",
    "  v_blocked_start boolean := false;",
    "  v_blocked_end boolean := false;",
    "BEGIN",
    `  PERFORM 1 FROM public.communities WHERE id = '${commId}' FOR UPDATE;`,
    `  PERFORM 1 FROM public.channels WHERE id = '${chId}' FOR UPDATE;`,
    "  BEGIN",
    `    PERFORM 1 FROM public.chats WHERE id = '${srcGroupId}' FOR UPDATE;`,
    "    FOR i IN 1..120 LOOP",
    "      SELECT l.pid INTO v_blocked_pid",
    "      FROM pg_locks l",
    "      WHERE NOT l.granted",
    "        AND pg_backend_pid() = ANY(pg_blocking_pids(l.pid))",
    "        AND EXISTS (",
    "          SELECT 1 FROM pg_locks cl",
    "          WHERE cl.pid = l.pid",
    "            AND cl.relation = 'public.communities'::regclass",
    "            AND cl.mode = 'RowShareLock'",
    "            AND cl.granted",
    "        )",
    "      LIMIT 1;",
    "      SELECT l.pid INTO v_phase1_pid",
    "      FROM pg_locks l",
    "      WHERE NOT l.granted",
    "        AND pg_backend_pid() = ANY(pg_blocking_pids(l.pid))",
    "        AND EXISTS (",
    "          SELECT 1 FROM pg_locks cl",
    "          WHERE cl.pid = l.pid",
    "            AND cl.relation = 'public.chats'::regclass",
    "            AND cl.mode = 'RowExclusiveLock'",
    "            AND cl.granted",
    "        )",
    "      LIMIT 1;",
    "      IF v_blocked_pid IS NOT NULL AND v_phase1_pid IS NOT NULL THEN",
    "        v_blocked_start := true;",
    "        PERFORM pg_sleep(0.55);",
    "        RAISE EXCEPTION 'phase1_lock_confirmed';",
    "      END IF;",
    "      PERFORM pg_sleep(0.05);",
    "    END LOOP;",
    "  EXCEPTION WHEN OTHERS THEN",
    "    NULL;",
    "  END;",
    "  IF v_blocked_start THEN",
    "    FOR i IN 1..120 LOOP",
    "      SELECT l.pid INTO v_phase3_pid",
    "      FROM pg_locks l",
    "      WHERE NOT l.granted",
    "        AND pg_backend_pid() = ANY(pg_blocking_pids(l.pid))",
    "        AND EXISTS (",
    "          SELECT 1 FROM pg_locks cl",
    "          WHERE cl.pid = l.pid",
    "            AND cl.relation = 'public.channels'::regclass",
    "            AND cl.mode = 'RowExclusiveLock'",
    "            AND cl.granted",
    "        )",
    "      LIMIT 1;",
    "      IF v_phase3_pid IS NOT NULL THEN",
    "        v_blocked_end := (",
    "          v_blocked_pid IS NOT NULL",
    "          AND pg_backend_pid() = ANY(pg_blocking_pids(v_blocked_pid))",
    "          AND EXISTS (",
    "            SELECT 1 FROM pg_locks l",
    "            WHERE l.pid = v_blocked_pid AND NOT l.granted",
    "          )",
    "        );",
    "        EXIT;",
    "      END IF;",
    "      PERFORM pg_sleep(0.05);",
    "    END LOOP;",
    "  END IF;",
    "  INSERT INTO _lock_obs VALUES (pg_backend_pid(), v_blocked_pid, v_phase1_pid, v_phase3_pid, v_blocked_start, v_blocked_end);",
    "END $$;",
    "SELECT holder_pid, blocked_pid, phase1_gate_pid, phase3_gate_pid, blocked_at_start, blocked_at_end FROM _lock_obs;",
  ].join(" ");

  raceObservations.unrelatedSendsUnderCommunityLock = await runCommunityLockIsolationScenario({
    spawnLockHolder: () =>
      spawn(
        process.execPath,
        [cliScript, "--workdir", rootDir, "db", "query", "--linked", lockSql],
        {
          stdio: ["ignore", "pipe", "pipe"],
        },
      ),
    probeControlWrite: (attempt) =>
      uAdmin.client.from("messages").insert({
        chat_id: avisosChat.id,
        sender_id: uAdmin.user.id,
        content: `Lock probe ${attempt}`,
      }),
    confirmLockHeld: async (attempt) => {
      const tGate = performance.now();
      const gateRes = await admin
        .from("chats")
        .update({ description: `Phase1 lock gate ${attempt}` })
        .eq("id", srcGroupId);
      assert.ifError(gateRes.error);
      const gateElapsedMs = performance.now() - tGate;
      // The holder holds v_phase1_pid for 550ms after confirming v_blocked_pid in pg_locks
      // before rolling back the subtransaction on srcGroupId.
      return { confirmed: gateElapsedMs >= 450 };
    },
    runUnrelatedWrites: () =>
      Promise.all([
        uMember.client.from("messages").insert({
          chat_id: directChatId,
          sender_id: uMember.user.id,
          content: "Unrelated direct send while community locked",
        }),
        uMember.client.from("messages").insert({
          chat_id: grpId,
          sender_id: uMember.user.id,
          content: "Unrelated group send while community locked",
        }),
      ]),
    signalUnrelatedWritesCompleted: () =>
      admin.from("channels").update({ description: "Phase3 completion gate" }).eq("id", chId),
  });

  primaryPassed = true;
} finally {
  await cleanup.cleanupAndVerifyChannel(admin, uOwner?.client, chId);
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
  if (directChatId) {
    await cleanup.runStep("delete_direct_chat", () =>
      admin.from("chats").delete().eq("id", directChatId),
    );
  }
  for (const uid of registeredUserIds) {
    await cleanup.runStep(`delete_user:${uid}`, () => admin.auth.admin.deleteUser(uid));
  }

  await cleanup.verifyRowAbsent(admin, "communities", commId, "communities");
  await cleanup.verifyRowAbsent(admin, "chats", grpId, "chats");
  await cleanup.verifyRowAbsent(admin, "chats", srcGroupId, "chats");
  await cleanup.verifyRowAbsent(admin, "chats", directChatId, "chats");
  for (const uid of registeredUserIds) {
    await cleanup.verifyUserAbsent(admin, uid);
  }

  try {
    const summary = cleanup.emitSummary({
      suite: "shared-roles-concurrency",
      origin: url,
      passed: primaryPassed,
      metrics: raceObservations,
    });
    if (summary.passed) {
      console.log("ALL STAGING TWO-SESSION CONCURRENCY CHECKS PASSED!");
    }
  } catch (cleanupErr) {
    console.error(cleanupErr);
    process.exitCode = 1;
  }
}
