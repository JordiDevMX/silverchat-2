import type { ChatDetails } from "../../messages/types.ts";
export type ChatAction =
  | "view_profile"
  | "view_group_info"
  | "change_chat_photo"
  | "view_community_info"
  | "search_in_chat"
  | "mute"
  | "unmute"
  | "mark_unread"
  | "pin"
  | "unpin"
  | "clear_chat"
  | "block"
  | "view_members"
  | "add_members"
  | "leave_group";
export function getAvailableChatActions(chat: ChatDetails): ChatAction[] {
  const pin = chat.own?.pinned_at ? "unpin" : "pin";
  if (chat.type === "self") return ["search_in_chat", pin, "clear_chat"];
  if (chat.readOnly) {
    if (chat.type === "community_chat") return ["view_community_info", "search_in_chat"];
    if (chat.type === "group") return ["view_group_info", "search_in_chat"];
    return ["view_profile", "search_in_chat", "block"];
  }
  const muted = !!chat.own?.muted_until && Date.parse(chat.own.muted_until) > Date.now();
  const common: ChatAction[] = [
    "search_in_chat",
    muted ? "unmute" : "mute",
    "mark_unread",
    pin,
    "clear_chat",
  ];
  if (chat.type === "direct") return ["view_profile", ...common, "block"];
  if (chat.type === "community_chat")
    return [
      "view_community_info",
      ...(chat.own?.role === "admin" ? ["change_chat_photo" as const] : []),
      ...common,
    ];
  return [
    "view_group_info",
    ...common,
    "view_members",
    ...(chat.own?.role === "admin" ? ["add_members" as const] : []),
    "leave_group",
  ];
}
export type ChannelAction =
  | "view_channel_info"
  | "search_in_chat"
  | "mute"
  | "mark_unread"
  | "follow"
  | "unfollow"
  | "copy_channel_link"
  | "report";
export type ChannelActionContext = {
  following: boolean;
  canSearch: boolean;
  hasLink: boolean;
  isOwner?: boolean;
};
export function getAvailableChannelActions(context: ChannelActionContext): ChannelAction[] {
  return [
    "view_channel_info",
    ...(context.canSearch ? ["search_in_chat" as const] : []),
    ...(context.following ? ["mute" as const, "mark_unread" as const] : []),
    context.following ? "unfollow" : "follow",
    ...(context.hasLink ? ["copy_channel_link" as const] : []),
    ...(!context.isOwner ? ["report" as const] : []),
  ];
}
export type ReportReason = "spam" | "harassment" | "inappropriate" | "other";
export type ReportTarget =
  | {
      kind: "channel";
      channelId: string;
      name: string;
      slug?: string | null;
      blockUserId?: string | null;
    }
  | {
      kind: "user";
      userId: string;
      name: string;
      username?: string | null;
      blockUserId?: string | null;
    };
export function buildReportPayload(
  reporterId: string,
  target: ReportTarget,
  reason: ReportReason,
  description: string,
) {
  const trimmed = description.trim();
  return {
    reporter_id: reporterId,
    reported_channel_id: target.kind === "channel" ? target.channelId : null,
    reported_user_id: target.kind === "user" ? target.userId : null,
    reason,
    description: trimmed || null,
  };
}
export const directPairKey = (a: string, b: string) => [a, b].sort().join("::");
export const muteUntil = (hours: number | null, now = Date.now()) =>
  hours === null
    ? null
    : hours === Infinity
      ? "9999-12-31T23:59:59Z"
      : new Date(now + hours * 3600000).toISOString();
export function validReport(reason: string, description: string) {
  return (
    ["spam", "harassment", "inappropriate", "other"].includes(reason) &&
    description.length <= 500 &&
    (reason !== "other" || !!description.trim())
  );
}
export function toggleMember(ids: string[], id: string) {
  if (ids.includes(id)) return ids.filter((value) => value !== id);
  if (ids.length >= 50) throw new Error("You can select up to 50 members at once");
  return [...ids, id];
}
