import type {
  ChannelRole,
  CommunityRole,
  CommunityWriteContext,
  GroupPermissions,
  GroupPermissionsPreset,
  GroupRole,
} from "../types.ts";

export const DEFAULT_GROUP_PERMISSIONS: GroupPermissions = {
  onlyAdminsCanAddMembers: false,
  onlyAdminsCanShareLink: false,
  onlyAdminsCanSend: false,
  onlyAdminsCanEditInfo: false,
  requireAdminApproval: false,
};

export function resolveGroupPreset(perms: GroupPermissions): GroupPermissionsPreset {
  const flags = [
    perms.onlyAdminsCanAddMembers,
    perms.onlyAdminsCanShareLink,
    perms.onlyAdminsCanSend,
    perms.onlyAdminsCanEditInfo,
    perms.requireAdminApproval,
  ];
  if (flags.every((f) => !f)) return "open";
  if (flags.every((f) => f)) return "restricted";
  return "custom";
}

export function applyGroupPreset(
  preset: Exclude<GroupPermissionsPreset, "custom">,
): GroupPermissions {
  const flag = preset === "restricted";
  return {
    onlyAdminsCanAddMembers: flag,
    onlyAdminsCanShareLink: flag,
    onlyAdminsCanSend: flag,
    onlyAdminsCanEditInfo: flag,
    requireAdminApproval: flag,
  };
}

export function resolveGroupRole(
  memberRole: "admin" | "member" | undefined,
  userId: string | undefined,
  ownerId: string | null | undefined,
): GroupRole {
  if (userId && ownerId && userId === ownerId) return "owner";
  return memberRole === "admin" ? "admin" : "member";
}

export function isGroupStaff(role: GroupRole): boolean {
  return role === "owner" || role === "admin";
}

export function canAddGroupMembers(role: GroupRole, perms: GroupPermissions): boolean {
  return isGroupStaff(role) || !perms.onlyAdminsCanAddMembers;
}

export function canShareGroupLink(role: GroupRole, perms: GroupPermissions): boolean {
  return isGroupStaff(role) || !perms.onlyAdminsCanShareLink;
}

export function canSendGroupMessages(role: GroupRole, perms: GroupPermissions): boolean {
  return isGroupStaff(role) || !perms.onlyAdminsCanSend;
}

export function canEditGroupInfo(role: GroupRole, perms: GroupPermissions): boolean {
  return isGroupStaff(role) || !perms.onlyAdminsCanEditInfo;
}

export function canManageGroupSettings(role: GroupRole): boolean {
  return isGroupStaff(role);
}

export function canPromoteGroupAdmin(actorRole: GroupRole, targetRole: GroupRole): boolean {
  return isGroupStaff(actorRole) && targetRole === "member";
}

export function canDemoteGroupMember(actorRole: GroupRole, targetRole: GroupRole): boolean {
  if (targetRole === "owner") return false;
  if (targetRole === "admin") return actorRole === "owner";
  return false;
}

export function canRemoveGroupMember(actorRole: GroupRole, targetRole: GroupRole): boolean {
  if (targetRole === "owner") return false;
  if (targetRole === "admin") return actorRole === "owner";
  return isGroupStaff(actorRole);
}

export function resolveChannelRole(
  staffRole: "owner" | "admin" | null | undefined,
  following: boolean,
): ChannelRole {
  if (staffRole === "owner") return "owner";
  if (staffRole === "admin") return "admin";
  return following ? "follower" : "visitor";
}

export function canPublishChannelPost(role: ChannelRole): boolean {
  return role === "owner" || role === "admin";
}

export function canDeleteChannelPost(
  role: ChannelRole,
  actorId: string | undefined,
  authorId: string | null | undefined,
): boolean {
  if (role === "owner") return true;
  if (role === "admin") return Boolean(actorId && authorId && actorId === authorId);
  return false;
}

export function canEditChannelInfo(role: ChannelRole): boolean {
  return role === "owner";
}

export function canManageChannelStaff(role: ChannelRole): boolean {
  return role === "owner";
}

export function canSendChannelInvitation(role: ChannelRole): boolean {
  return role === "owner" || role === "admin" || role === "follower";
}

export function canReportChannel(role: ChannelRole): boolean {
  return role !== "owner";
}

export function canReactInChannel(): boolean {
  return false;
}

export function communityRoleRank(role: CommunityRole): number {
  switch (role) {
    case "owner":
      return 4;
    case "admin":
      return 3;
    case "moderator":
      return 2;
    default:
      return 1;
  }
}

export function resolveCommunityRole(
  memberRole: "admin" | "moderator" | "member" | undefined,
  userId: string | undefined,
  ownerId: string | null | undefined,
): CommunityRole {
  if (userId && ownerId && userId === ownerId) return "owner";
  if (memberRole === "admin") return "admin";
  if (memberRole === "moderator") return "moderator";
  return "member";
}

export function canEditCommunityName(role: CommunityRole): boolean {
  return communityRoleRank(role) >= 3;
}

export function canEditCommunityDescription(role: CommunityRole): boolean {
  return communityRoleRank(role) >= 2;
}

export function canEditCommunityChatName(role: CommunityRole): boolean {
  return communityRoleRank(role) >= 3;
}

export function canEditCommunityChatDescription(role: CommunityRole): boolean {
  return communityRoleRank(role) >= 2;
}

export function canManageCommunityModerators(role: CommunityRole): boolean {
  return communityRoleRank(role) >= 3;
}

export function canManageCommunityAdmins(role: CommunityRole): boolean {
  return role === "owner";
}

export function canSilenceTarget(actorRole: CommunityRole, targetRole: CommunityRole): boolean {
  const actorRank = communityRoleRank(actorRole);
  const targetRank = communityRoleRank(targetRole);
  return actorRank >= 2 && targetRank < actorRank;
}

export function canExpelTarget(actorRole: CommunityRole, targetRole: CommunityRole): boolean {
  return canSilenceTarget(actorRole, targetRole);
}

export function canUnbanCommunityMember(role: CommunityRole): boolean {
  return communityRoleRank(role) >= 3;
}

export function canModerateDeleteMessage(
  actorRole: CommunityRole,
  authorRole: CommunityRole | null,
): boolean {
  const actorRank = communityRoleRank(actorRole);
  if (actorRank < 2) return false;
  if (authorRole === null) return true;
  return communityRoleRank(authorRole) < actorRank;
}

export function canTransferCommunityOwnership(
  actorRole: CommunityRole,
  actorId: string | undefined,
  targetUserId: string | undefined,
): boolean {
  return actorRole === "owner" && Boolean(actorId && targetUserId && actorId !== targetUserId);
}

export function isSilenced(silencedUntil: string | null | undefined, nowMs = Date.now()): boolean {
  if (!silencedUntil) return false;
  const ts = Date.parse(silencedUntil);
  return Number.isFinite(ts) && ts > nowMs;
}

export function canWriteInCommunityChat(ctx: CommunityWriteContext, nowMs = Date.now()): boolean {
  if (isSilenced(ctx.silencedUntil, nowMs)) return false;
  const rank = communityRoleRank(ctx.role);
  if (ctx.systemRole === "announcements") {
    return rank >= 3 || (ctx.role === "moderator" && Boolean(ctx.isAnnouncementWriter));
  }
  switch (ctx.writePolicy) {
    case "owner_only":
      return rank >= 4;
    case "admins":
      return rank >= 3;
    case "moderators":
      return rank >= 2;
    default:
      return true;
  }
}

export function getRoleLabel(
  role: GroupRole | ChannelRole | CommunityRole,
  say: (en: string, es: string) => string,
): string {
  switch (role) {
    case "owner":
      return say("Owner", "Propietario");
    case "admin":
      return say("Admin", "Admin");
    case "moderator":
      return say("Moderator", "Moderador");
    case "follower":
      return say("Follower", "Seguidor");
    case "visitor":
      return say("Visitor", "Visitante");
    default:
      return say("Member", "Miembro");
  }
}
