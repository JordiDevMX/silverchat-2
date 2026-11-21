export type GroupRole = "owner" | "admin" | "member";
export type ChannelRole = "owner" | "admin" | "follower" | "visitor";
export type CommunityRole = "owner" | "admin" | "moderator" | "member";
export type CommunityWritePolicy = "all" | "moderators" | "admins" | "owner_only";
export type GroupPermissionsPreset = "open" | "restricted" | "custom";

export interface GroupPermissions {
  onlyAdminsCanAddMembers: boolean;
  onlyAdminsCanShareLink: boolean;
  onlyAdminsCanSend: boolean;
  onlyAdminsCanEditInfo: boolean;
  requireAdminApproval: boolean;
}

export interface CommunityWriteContext {
  role: CommunityRole;
  systemRole?: "announcements" | null;
  writePolicy: CommunityWritePolicy;
  isAnnouncementWriter?: boolean;
  silencedUntil?: string | null;
}
