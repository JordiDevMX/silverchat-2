import { canModerateDeleteMessage } from "../../roles/lib/permissions.ts";
import type { ChatDetails, Message } from "../types.ts";
export type MessageAction =
  | "reply"
  | "react"
  | "copy"
  | "forward"
  | "pin"
  | "unpin"
  | "edit"
  | "delete_for_me"
  | "delete_for_everyone";

export function canModerateCommunityMessage(
  chat: Pick<ChatDetails, "type" | "communityRole" | "communityAuthorRoles" | "own">,
  message: Pick<Message, "sender_id" | "deleted_for_everyone" | "type">,
): boolean {
  if (chat.type !== "community_chat" || message.deleted_for_everyone || message.type === "system") {
    return false;
  }
  const actorRole = chat.communityRole ?? (chat.own?.role === "admin" ? "admin" : "member");
  const authorRole = message.sender_id
    ? (chat.communityAuthorRoles?.[message.sender_id] ?? null)
    : null;
  return canModerateDeleteMessage(actorRole, authorRole);
}

export function getAvailableActions(
  message: Message,
  userId: string,
  readOnly = false,
  now = Date.now(),
  writeRestricted = false,
  channelStaffRole: "owner" | "admin" | null = null,
  communityDeleteAllowed = false,
): MessageAction[] {
  if (message.type === "system" || message.localStatus || message.id.startsWith("temp-")) return [];
  if (message.channel_id) {
    if (message.deleted_for_everyone) {
      return [];
    }
    const channelActions: MessageAction[] = [];
    if (["text", "file"].includes(message.type) && message.content) channelActions.push("copy");
    channelActions.push("forward");
    const age = now - Date.parse(message.created_at);
    if (
      channelStaffRole &&
      message.sender_id === userId &&
      age >= 0 &&
      age < 900000 &&
      ["text", "image", "video"].includes(message.type)
    ) {
      channelActions.push("edit");
    }
    if (
      channelStaffRole === "owner" ||
      (channelStaffRole === "admin" && message.sender_id === userId)
    ) {
      channelActions.push("delete_for_everyone");
    }
    return channelActions;
  }
  if (readOnly)
    return !message.deleted_for_everyone &&
      ["text", "file"].includes(message.type) &&
      message.content
      ? ["copy"]
      : [];
  if (message.deleted_for_everyone) return ["delete_for_me"];
  const actions: MessageAction[] = writeRestricted ? ["react"] : ["reply", "react"];
  if (["text", "file"].includes(message.type) && message.content) actions.push("copy");
  actions.push("forward", message.is_pinned_in_chat ? "unpin" : "pin");
  const age = now - Date.parse(message.created_at);
  if (
    message.sender_id === userId &&
    age >= 0 &&
    age < 900000 &&
    ["text", "image", "video"].includes(message.type)
  )
    actions.push("edit");
  actions.push("delete_for_me");
  if ((message.sender_id === userId && age >= 0 && age < 3600000) || communityDeleteAllowed)
    actions.push("delete_for_everyone");
  return actions;
}
