import { canWriteInCommunityChat } from "../../roles/lib/permissions.ts";
import type { ChatDetails, Member } from "../types.ts";

/** Returns true when a group or community chat restricts sending to admins or silences the viewer. */
export function isWriteRestricted(
  chat: Pick<
    ChatDetails,
    | "type"
    | "onlyAdminsCanSend"
    | "own"
    | "channelMode"
    | "communityRole"
    | "systemRole"
    | "writePolicy"
    | "isAnnouncementWriter"
    | "communitySilencedUntil"
  >,
): boolean {
  if (chat.channelMode) return false;
  if (chat.type === "group") {
    return Boolean(chat.onlyAdminsCanSend) && chat.own?.role !== "admin";
  }
  if (chat.type === "community_chat") {
    const role = chat.communityRole ?? (chat.own?.role === "admin" ? "admin" : "member");
    const writePolicy = chat.writePolicy ?? (chat.onlyAdminsCanSend ? "admins" : "all");
    return !canWriteInCommunityChat({
      role,
      systemRole: chat.systemRole ?? null,
      writePolicy,
      isAnnouncementWriter: chat.isAnnouncementWriter,
      silencedUntil: chat.communitySilencedUntil,
    });
  }
  return false;
}

/** Only regular group admins in group settings context may toggle the write-permission rule. */
export function canManageGroupWriteRule(
  context: "group" | "community",
  type: ChatDetails["type"],
  role?: Member["role"],
): boolean {
  return context === "group" && type === "group" && role === "admin";
}
