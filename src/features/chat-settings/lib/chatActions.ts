import type { ChatDetails } from "../../messages/types.ts";
export type ChatAction =
  | "view_profile"
  | "view_group_info"
  | "view_community_info"
  | "search_in_chat"
  | "mute"
  | "unmute"
  | "mark_unread"
  | "pin"
  | "unpin"
  | "clear_chat"
  | "block"
  | "report"
  | "view_members"
  | "add_members"
  | "leave_group";
export function getAvailableChatActions(chat: ChatDetails): ChatAction[] {
  const pin = chat.own?.pinned_at ? "unpin" : "pin";
  if (chat.type === "self") return ["search_in_chat", pin, "clear_chat"];
  if (chat.readOnly) {
    if (chat.type === "community_chat") return ["view_community_info", "search_in_chat"];
    if (chat.type === "group") return ["view_group_info", "search_in_chat"];
    return ["view_profile", "search_in_chat", "block", "report"];
  }
  const muted = !!chat.own?.muted_until && Date.parse(chat.own.muted_until) > Date.now();
  const common: ChatAction[] = [
    "search_in_chat",
    muted ? "unmute" : "mute",
    "mark_unread",
    pin,
    "clear_chat",
  ];
  if (chat.type === "direct") return ["view_profile", ...common, "block", "report"];
  if (chat.type === "community_chat") return ["view_community_info", ...common];
  return [
    "view_group_info",
    ...common,
    "view_members",
    ...(chat.own?.role === "admin" ? ["add_members" as const] : []),
    "leave_group",
  ];
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
