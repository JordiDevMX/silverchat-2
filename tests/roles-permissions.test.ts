import assert from "node:assert/strict";
import test from "node:test";
import {
  parseChannelInvitationResults,
  parseCustomSilenceMinutes,
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
import { encodeQrMatrix } from "../src/features/roles/lib/qr.ts";

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

test("encodeQrMatrix produces valid ISO QR finder patterns and sizing for group invite URLs", () => {
  const url = "https://silverchat.app/chats/join/tok_abcdefghijklmnopqrstuvwxyz123456";
  const qr = encodeQrMatrix(url);
  assert.ok(qr.version >= 4 && qr.version <= 10);
  assert.equal(qr.modules.length, qr.size * qr.size);
  const at = (r: number, c: number) => qr.modules[r * qr.size + c];
  // 7x7 finder center (3,3), top-right (3, n-4), bottom-left (n-4, 3) are dark; dark module (4*v+9, 8)
  assert.equal(at(3, 3), true);
  assert.equal(at(3, qr.size - 4), true);
  assert.equal(at(qr.size - 4, 3), true);
  assert.equal(at(1, 1), false);
  assert.equal(at(4 * qr.version + 9, 8), true);
});
