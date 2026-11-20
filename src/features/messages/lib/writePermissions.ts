import type { ChatDetails, Member } from "../types.ts";

/** Returns true when a group or community chat restricts sending to admins and the viewer is not an admin. */
export function isWriteRestricted(
  chat: Pick<ChatDetails, "type" | "onlyAdminsCanSend" | "own" | "channelMode">,
): boolean {
  if (chat.channelMode) return false;
  if (chat.type !== "group" && chat.type !== "community_chat") return false;
  return Boolean(chat.onlyAdminsCanSend) && chat.own?.role !== "admin";
}

/** Only regular group admins in group settings context may toggle the write-permission rule. */
export function canManageGroupWriteRule(
  context: "group" | "community",
  type: ChatDetails["type"],
  role?: Member["role"],
): boolean {
  return context === "group" && type === "group" && role === "admin";
}
