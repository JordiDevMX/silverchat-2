import type { Community, CommunityChat } from "../types.ts";

export type CommunityAction =
  | "view_info"
  | "view_members"
  | "mute"
  | "unmute"
  | "add_members"
  | "create_chat"
  | "leave"
  | "delete";
export function getAvailableCommunityActions(
  community: Community,
  userId: string,
  isAdmin: boolean,
  isOwner: boolean,
  isMuted: boolean,
): CommunityAction[] {
  return [
    "view_info",
    "view_members",
    isMuted ? "unmute" : "mute",
    ...(isAdmin ? (["add_members", "create_chat"] as const) : []),
    "leave",
    ...(isOwner && community.owner_id === userId ? (["delete"] as const) : []),
  ];
}
export function orderCommunities(items: Community[]) {
  return [...items].sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id),
  );
}
export function orderCommunityChats(items: CommunityChat[]) {
  return [...items].sort(
    (a, b) =>
      (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "") ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  );
}
export function formatCommunityTimestamp(value: string | null, locale: string, now = new Date()) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const elapsed = Math.max(0, now.getTime() - date.getTime());
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (date.toDateString() === now.toDateString())
    return elapsed < 3_600_000
      ? relative.format(-Math.floor(elapsed / 60_000), "minute")
      : relative.format(-Math.floor(elapsed / 3_600_000), "hour");
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return relative.format(-1, "day");
  return new Intl.DateTimeFormat(
    locale,
    elapsed < 7 * 86_400_000
      ? { weekday: "short" }
      : { day: "2-digit", month: "2-digit", year: "numeric" },
  ).format(date);
}
