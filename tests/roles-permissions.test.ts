import assert from "node:assert/strict";
import test from "node:test";
import jsQRImport from "jsqr";

const decodeQr = (typeof jsQRImport === "function" ? jsQRImport : jsQRImport.default) as (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" },
) => { data: string } | null;

import {
  MAX_CHANNEL_INVITATIONS_PER_BATCH,
  parseChannelInvitationResults,
  parseCustomSilenceMinutes,
  sendChannelInvitationsInBatches,
} from "../src/features/novedades/lib/channelInvitations.ts";
import {
  canAddGroupMembers,
  canDeleteChannelPost,
  canDemoteGroupMember,
  canEditCommunityChatDescription,
  canEditCommunityChatName,
  canEditCommunityDescription,
  canEditCommunityName,
  canEditGroupInfo,
  canExpelTarget,
  canManageChannelStaff,
  canManageCommunityAdmins,
  canManageCommunityModerators,
  canModerateDeleteMessage,
  canPublishChannelPost,
  canReactInChannel,
  canRemoveGroupMember,
  canReportChannel,
  canSendChannelInvitation,
  canSendGroupMessages,
  canShareGroupLink,
  canSilenceTarget,
  canTransferCommunityOwnership,
  canUnbanCommunityMember,
  canWriteInCommunityChat,
  DEFAULT_GROUP_PERMISSIONS,
  resolveGroupPreset,
} from "../src/features/roles/lib/permissions.ts";
import { encodeQrMatrix, qrToSvgPath } from "../src/features/roles/lib/qr.ts";
import {
  createStagingTestUser,
  parseAuthorizedStagingOrigin,
  StagingCleanupVerifier,
} from "./lib/staging-live.mjs";

test("Group permissions matrix enforces OC-01 and configurable 5 toggles", () => {
  assert.deepEqual(DEFAULT_GROUP_PERMISSIONS, {
    onlyAdminsCanAddMembers: false,
    onlyAdminsCanShareLink: false,
    onlyAdminsCanSend: false,
    onlyAdminsCanEditInfo: false,
    requireAdminApproval: false,
  });
  assert.equal(resolveGroupPreset(DEFAULT_GROUP_PERMISSIONS), "open");
  assert.equal(
    resolveGroupPreset({
      onlyAdminsCanAddMembers: true,
      onlyAdminsCanShareLink: true,
      onlyAdminsCanSend: true,
      onlyAdminsCanEditInfo: true,
      requireAdminApproval: true,
    }),
    "restricted",
  );
  assert.equal(
    resolveGroupPreset({ ...DEFAULT_GROUP_PERMISSIONS, onlyAdminsCanEditInfo: true }),
    "custom",
  );

  // Member actions follow the configured flags
  assert.equal(canAddGroupMembers("member", DEFAULT_GROUP_PERMISSIONS), true);
  assert.equal(canShareGroupLink("member", DEFAULT_GROUP_PERMISSIONS), true);
  assert.equal(canSendGroupMessages("member", DEFAULT_GROUP_PERMISSIONS), true);
  assert.equal(canEditGroupInfo("member", DEFAULT_GROUP_PERMISSIONS), true);

  const locked = {
    ...DEFAULT_GROUP_PERMISSIONS,
    onlyAdminsCanAddMembers: true,
    onlyAdminsCanShareLink: true,
    onlyAdminsCanSend: true,
    onlyAdminsCanEditInfo: true,
  };
  assert.equal(canAddGroupMembers("member", locked), false);
  assert.equal(canShareGroupLink("member", locked), false);
  assert.equal(canSendGroupMessages("member", locked), false);
  assert.equal(canEditGroupInfo("member", locked), false);
  assert.equal(canEditGroupInfo("admin", locked), true);

  // OC-01: Only owner can demote or remove an admin; nobody can demote/remove owner; admin can remove member
  assert.equal(canDemoteGroupMember("admin", "admin"), false);
  assert.equal(canDemoteGroupMember("admin", "owner"), false);
  assert.equal(canDemoteGroupMember("owner", "admin"), true);
  assert.equal(canDemoteGroupMember("owner", "owner"), false);

  assert.equal(canRemoveGroupMember("admin", "admin"), false);
  assert.equal(canRemoveGroupMember("admin", "owner"), false);
  assert.equal(canRemoveGroupMember("admin", "member"), true);
  assert.equal(canRemoveGroupMember("owner", "admin"), true);
  assert.equal(canRemoveGroupMember("owner", "owner"), false);
});

test("Channel permissions matrix enforces OC-03 and OC-04", () => {
  assert.equal(canPublishChannelPost("owner"), true);
  assert.equal(canPublishChannelPost("admin"), true);
  assert.equal(canPublishChannelPost("follower"), false);
  assert.equal(canPublishChannelPost("visitor"), false);

  // OC-03: Admin deletes own posts only; owner deletes any post
  assert.equal(canDeleteChannelPost("admin", "u-admin", "u-admin"), true);
  assert.equal(canDeleteChannelPost("admin", "u-admin", "u-owner"), false);
  assert.equal(canDeleteChannelPost("owner", "u-owner", "u-admin"), true);
  assert.equal(canManageChannelStaff("admin"), false);
  assert.equal(canManageChannelStaff("owner"), true);

  // OC-04: Invitations by owner, admin, follower (not visitor); reporting by non-owner (incl. admin/follower/visitor)
  assert.equal(canSendChannelInvitation("owner"), true);
  assert.equal(canSendChannelInvitation("admin"), true);
  assert.equal(canSendChannelInvitation("follower"), true);
  assert.equal(canSendChannelInvitation("visitor"), false);

  assert.equal(canReportChannel("owner"), false);
  assert.equal(canReportChannel("admin"), true);
  assert.equal(canReportChannel("follower"), true);
  assert.equal(canReportChannel("visitor"), true);

  assert.equal(canReactInChannel(), false);
});

test("Community permissions matrix enforces moderator, OC-05, OC-06, and announcements rules", () => {
  assert.equal(canEditCommunityName("moderator"), false);
  assert.equal(canEditCommunityName("admin"), true);
  assert.equal(canEditCommunityDescription("moderator"), true);
  assert.equal(canEditCommunityChatName("moderator"), false);
  assert.equal(canEditCommunityChatDescription("moderator"), true);

  // Silencing & expulsion hierarchy
  assert.equal(canSilenceTarget("moderator", "member"), true);
  assert.equal(canSilenceTarget("moderator", "moderator"), false);
  assert.equal(canSilenceTarget("moderator", "admin"), false);
  assert.equal(canSilenceTarget("admin", "moderator"), true);
  assert.equal(canSilenceTarget("admin", "admin"), false);
  assert.equal(canSilenceTarget("owner", "admin"), true);

  assert.equal(canExpelTarget("moderator", "member"), true);
  assert.equal(canExpelTarget("moderator", "admin"), false);
  assert.equal(canUnbanCommunityMember("moderator"), false);
  assert.equal(canUnbanCommunityMember("admin"), true);

  // OC-06: Moderator can delete member and departed messages (null authorRole), NOT active admin/owner
  assert.equal(canModerateDeleteMessage("moderator", "member"), true);
  assert.equal(canModerateDeleteMessage("moderator", null), true);
  assert.equal(canModerateDeleteMessage("moderator", "admin"), false);
  assert.equal(canModerateDeleteMessage("moderator", "owner"), false);
  assert.equal(canModerateDeleteMessage("admin", "owner"), false);
  assert.equal(canModerateDeleteMessage("admin", "moderator"), true);
  assert.equal(canModerateDeleteMessage("owner", "admin"), true);

  // OC-05: Ownership transfer
  assert.equal(canTransferCommunityOwnership("owner", "u-owner", "u-member"), true);
  assert.equal(canTransferCommunityOwnership("owner", "u-owner", "u-owner"), false);
  assert.equal(canTransferCommunityOwnership("admin", "u-admin", "u-member"), false);

  // Announcements & write_policy
  assert.equal(
    canWriteInCommunityChat({
      role: "moderator",
      systemRole: "announcements",
      writePolicy: "admins",
      isAnnouncementWriter: true,
      silencedUntil: null,
    }),
    true,
  );
  assert.equal(
    canWriteInCommunityChat({
      role: "moderator",
      systemRole: "announcements",
      writePolicy: "admins",
      isAnnouncementWriter: false,
      silencedUntil: null,
    }),
    false,
  );
  assert.equal(
    canWriteInCommunityChat({
      role: "member",
      systemRole: null,
      writePolicy: "all",
      isAnnouncementWriter: false,
      silencedUntil: new Date(Date.now() + 60_000).toISOString(),
    }),
    false,
  );

  // Finding 5: community admin promotion is owner-only; moderators manageable by admin/owner
  assert.equal(canManageCommunityAdmins("owner"), true);
  assert.equal(canManageCommunityAdmins("admin"), false);
  assert.equal(canManageCommunityAdmins("moderator"), false);
  assert.equal(canManageCommunityModerators("admin"), true);
  assert.equal(canManageCommunityModerators("moderator"), false);
});

test("parseChannelInvitationResults distinguishes partial successes, failures, and missing entries", () => {
  const mixed = parseChannelInvitationResults(
    [
      { recipient_id: "u1", id: "inv-1", ok: true },
      { recipient_id: "u2", ok: false, reason: "ineligible" },
    ],
    ["u1", "u2", "u3"],
  );
  assert.deepEqual(mixed.succeeded, ["u1"]);
  assert.deepEqual(mixed.failed, [
    { recipientId: "u2", reason: "ineligible" },
    { recipientId: "u3", reason: "unavailable" },
  ]);

  const invalid = parseChannelInvitationResults(null, ["u1"]);
  assert.deepEqual(invalid.succeeded, []);
  assert.deepEqual(invalid.failed, [{ recipientId: "u1", reason: "unavailable" }]);
});

test("parseCustomSilenceMinutes validates bounds and integer minutes", () => {
  assert.equal(parseCustomSilenceMinutes("10"), 600_000);
  assert.equal(parseCustomSilenceMinutes("43200"), 43200 * 60_000);
  assert.equal(parseCustomSilenceMinutes("0"), null);
  assert.equal(parseCustomSilenceMinutes("-5"), null);
  assert.equal(parseCustomSilenceMinutes("1.5"), null);
  assert.equal(parseCustomSilenceMinutes("50000"), null);
});

test("encodeQrMatrix preserves timing modules, valid BCH format copies, 4-module quiet zone, and round-trips via independent decoder", () => {
  for (const url of [
    "https://a.co/1",
    "https://silverchat.test/chats/join/9f66c2740ab04c23ad79541ed8b57e13",
    "https://silverchat.app/chats/join/tok_abcdefghijklmnopqrstuvwxyz1234567890_extra_len",
    "https://silverchat.app/chats/join/tok_v7_version_bits_coverage_abcdefghijklmnopqrstuvwxyz0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789",
  ]) {
    const qr = encodeQrMatrix(url);
    assert.ok(qr.version >= 1 && qr.version <= 10);
    assert.equal(qr.modules.length, qr.size * qr.size);
    const n = qr.size;
    const at = (r: number, c: number) => (qr.modules[r * n + c] ? 1 : 0);

    // 7x7 finders + dark module + unbroken alternating timing patterns on row/col 6
    assert.equal(at(3, 3), 1);
    assert.equal(at(3, n - 4), 1);
    assert.equal(at(n - 4, 3), 1);
    assert.equal(at(1, 1), 0);
    assert.equal(at(4 * qr.version + 9, 8), 1);
    for (let i = 8; i < n - 8; i++) {
      assert.equal(at(6, i), i % 2 === 0 ? 1 : 0, `Row 6 timing broken at col ${i}`);
      assert.equal(at(i, 6), i % 2 === 0 ? 1 : 0, `Col 6 timing broken at row ${i}`);
    }

    // Read both redundant 15-bit format copies (ISO/IEC 18004 Figure 25 coordinates)
    const copy1 =
      (at(0, 8) << 0) |
      (at(1, 8) << 1) |
      (at(2, 8) << 2) |
      (at(3, 8) << 3) |
      (at(4, 8) << 4) |
      (at(5, 8) << 5) |
      (at(7, 8) << 6) |
      (at(8, 8) << 7) |
      (at(8, 7) << 8) |
      (at(8, 5) << 9) |
      (at(8, 4) << 10) |
      (at(8, 3) << 11) |
      (at(8, 2) << 12) |
      (at(8, 1) << 13) |
      (at(8, 0) << 14);
    const copy2 =
      (at(8, n - 1) << 0) |
      (at(8, n - 2) << 1) |
      (at(8, n - 3) << 2) |
      (at(8, n - 4) << 3) |
      (at(8, n - 5) << 4) |
      (at(8, n - 6) << 5) |
      (at(8, n - 7) << 6) |
      (at(8, n - 8) << 7) |
      (at(n - 7, 8) << 8) |
      (at(n - 6, 8) << 9) |
      (at(n - 5, 8) << 10) |
      (at(n - 4, 8) << 11) |
      (at(n - 3, 8) << 12) |
      (at(n - 2, 8) << 13) |
      (at(n - 1, 8) << 14);
    assert.equal(copy1, copy2, "Redundant format copies must match identically");

    // Verify EC level L (01) and valid BCH(15, 5) syndrome after unmasking with 0x5412
    const unmasked = copy1 ^ 0x5412;
    assert.equal((unmasked >>> 13) & 0x3, 0b01, "Expected EC level L");
    let rem = unmasked;
    for (let i = 4; i >= 0; i--) {
      if (rem & (1 << (i + 10))) rem ^= 0x537 << i;
    }
    assert.equal(rem, 0, "Format info BCH syndrome must be zero");

    // Default SVG quiet zone margin is >= 4 modules (x,y coordinates start at >= 4)
    const path = qrToSvgPath(qr);
    assert.ok(
      path.startsWith("M4,4h1v1h-1z"),
      "Expected 4-module quiet zone around top-left finder",
    );

    // Rasterize matrix + 4-module quiet zone into RGBA and decode with independent jsQR decoder
    const margin = 4;
    const scale = 4;
    const dim = (n + margin * 2) * scale;
    const rgba = new Uint8ClampedArray(dim * dim * 4);
    rgba.fill(255);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.modules[r * n + c]) continue;
        for (let py = 0; py < scale; py++) {
          for (let px = 0; px < scale; px++) {
            const x = (c + margin) * scale + px;
            const y = (r + margin) * scale + py;
            const off = (y * dim + x) * 4;
            rgba[off] = 17;
            rgba[off + 1] = 17;
            rgba[off + 2] = 17;
          }
        }
      }
    }
    const decoded = decodeQr(rgba, dim, dim, { inversionAttempts: "dontInvert" });
    assert.equal(decoded?.data, url, `Independent jsQR decoder mismatch for version ${qr.version}`);
  }
});

test("sendChannelInvitationsInBatches splits >50 recipients, preserves cross-batch progress, and retries remainder", async () => {
  const recipients = Array.from({ length: 51 }, (_, i) => `u-${i + 1}`);
  const batchesSeen: string[][] = [];
  const progressed: string[] = [];

  const firstAttempt = await sendChannelInvitationsInBatches({
    channelId: "ch-1",
    recipientIds: recipients,
    getInvitationId: (id) => `inv-${id}`,
    onBatchSucceeded: (ids) => progressed.push(...ids),
    sendBatch: async (_channelId, batch) => {
      batchesSeen.push(batch.map((b) => b.recipient_id));
      assert.ok(batch.length <= MAX_CHANNEL_INVITATIONS_PER_BATCH);
      if (batchesSeen.length === 1) {
        return {
          data: batch.map((item) =>
            item.recipient_id === "u-2"
              ? { recipient_id: item.recipient_id, ok: false, reason: "ineligible" }
              : { recipient_id: item.recipient_id, id: item.id, ok: true },
          ),
          error: null,
        };
      }
      return { data: null, error: { message: "Batch 2 failed" } };
    },
  });

  assert.deepEqual(
    batchesSeen.map((b) => b.length),
    [50, 1],
  );
  assert.equal(firstAttempt.succeeded.length, 49);
  assert.equal(progressed.length, 49);
  assert.deepEqual(
    firstAttempt.failed.map((f) => f.recipientId),
    ["u-2", "u-51"],
  );
  assert.equal(firstAttempt.error?.message, "Batch 2 failed");

  const sentSet = new Set(firstAttempt.succeeded);
  const remaining = recipients.filter((id) => !sentSet.has(id));
  const retryBatches: string[][] = [];
  const retryAttempt = await sendChannelInvitationsInBatches({
    channelId: "ch-1",
    recipientIds: remaining,
    getInvitationId: (id) => `inv-${id}`,
    sendBatch: async (_channelId, batch) => {
      retryBatches.push(batch.map((b) => b.recipient_id));
      return {
        data: batch.map((item) => ({ recipient_id: item.recipient_id, id: item.id, ok: true })),
        error: null,
      };
    },
  });

  assert.deepEqual(retryBatches, [["u-2", "u-51"]]);
  assert.deepEqual(retryAttempt.failed, []);
  assert.equal(retryAttempt.error, null);
});

test("parseAuthorizedStagingOrigin binds origin to Staging ref before credential retrieval", () => {
  assert.equal(
    parseAuthorizedStagingOrigin(undefined, undefined),
    "https://gffdrrtatxdiucigtwdn.supabase.co",
  );
  assert.equal(
    parseAuthorizedStagingOrigin(
      "gffdrrtatxdiucigtwdn",
      "https://gffdrrtatxdiucigtwdn.supabase.co/",
    ),
    "https://gffdrrtatxdiucigtwdn.supabase.co",
  );
  assert.throws(() => parseAuthorizedStagingOrigin("lmzbaxlojgsdwgcxkmzx", undefined));
  assert.throws(() =>
    parseAuthorizedStagingOrigin("gffdrrtatxdiucigtwdn", "http://gffdrrtatxdiucigtwdn.supabase.co"),
  );
  assert.throws(() =>
    parseAuthorizedStagingOrigin(
      "gffdrrtatxdiucigtwdn",
      "https://lmzbaxlojgsdwgcxkmzx.supabase.co",
    ),
  );
  assert.throws(() =>
    parseAuthorizedStagingOrigin(
      "gffdrrtatxdiucigtwdn",
      "https://gffdrrtatxdiucigtwdn.supabase.co/rest/v1",
    ),
  );
});

test("StagingCleanupVerifier fails on non-404 bucket check (e.g. 503), leftover resources, and derives passed from cleanup", async () => {
  // 1. 404 / "Bucket not found" succeeds cleanly
  const cleanVerifier = new StagingCleanupVerifier();
  await cleanVerifier.verifyBucketAbsent(
    {
      storage: {
        getBucket: async () => ({
          data: null,
          error: { message: "Bucket not found", statusCode: "404" },
        }),
      },
    },
    "channel-media",
  );
  const okLines: string[] = [];
  const okSummary = cleanVerifier.emitSummary(
    { suite: "offline-clean", origin: "https://gffdrrtatxdiucigtwdn.supabase.co", passed: true },
    (l) => okLines.push(l),
  );
  assert.equal(okSummary.passed, true);
  assert.equal(okLines.length, 1);

  // 2. Synthetic Storage 503 during getBucket MUST fail and set passed=false even when primaryPassed=true
  const errVerifier = new StagingCleanupVerifier();
  await errVerifier.verifyBucketAbsent(
    {
      storage: {
        getBucket: async () => ({
          data: null,
          error: { message: "Service Unavailable", status: 503 },
        }),
      },
    },
    "channel-media",
  );
  const errLines: string[] = [];
  assert.throws(
    () =>
      errVerifier.emitSummary(
        { suite: "offline-503", origin: "https://gffdrrtatxdiucigtwdn.supabase.co", passed: true },
        (l) => errLines.push(l),
      ),
    /Staging cleanup verification failed/,
  );
  const errParsed = JSON.parse(errLines[0] ?? "{}") as {
    passed?: boolean;
    cleanup?: { cleanupErrors?: string[]; leftovers?: string[] };
  };
  assert.equal(errParsed.passed, false);
  assert.equal(errParsed.cleanup?.cleanupErrors?.length, 1);

  // 3. Existing bucket / leftover resource MUST fail with passed=false and non-empty leftovers
  const leftoverVerifier = new StagingCleanupVerifier();
  await leftoverVerifier.verifyBucketAbsent(
    {
      storage: {
        getBucket: async () => ({ data: { id: "channel-media" }, error: null }),
      },
    },
    "channel-media",
  );
  const leftoverLines: string[] = [];
  assert.throws(
    () =>
      leftoverVerifier.emitSummary(
        {
          suite: "offline-leftover",
          origin: "https://gffdrrtatxdiucigtwdn.supabase.co",
          passed: true,
        },
        (l) => leftoverLines.push(l),
      ),
    /Staging cleanup verification failed/,
  );
  const leftoverParsed = JSON.parse(leftoverLines[0] ?? "{}") as {
    passed?: boolean;
    cleanup?: { leftovers?: string[] };
  };
  assert.equal(leftoverParsed.passed, false);
  assert.deepEqual(leftoverParsed.cleanup?.leftovers, ["bucket:channel-media"]);
});

test("createStagingTestUser registers created user ID before sign-in so partial auth failure cleans up", async () => {
  const registered: string[] = [];
  await assert.rejects(
    () =>
      createStagingTestUser({
        url: "https://gffdrrtatxdiucigtwdn.supabase.co",
        anonKey: "anon",
        prefix: "srp-test",
        tag: "auth-fail",
        registeredUserIds: registered,
        admin: {
          auth: {
            admin: {
              createUser: async () => ({ data: { user: { id: "user-partial-1" } }, error: null }),
            },
          },
        },
        createClientFn: () => ({
          auth: {
            signInWithPassword: async () => ({
              data: null,
              error: new Error("Simulated auth outage"),
            }),
          },
        }),
      }),
    /Simulated auth outage/,
  );
  assert.deepEqual(registered, ["user-partial-1"]);
});
