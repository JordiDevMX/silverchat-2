import type { StoryGroup } from "../types.ts";
export function orderStoryGroups(groups: StoryGroup[], myUserId: string) {
  const sorted = [...groups].sort(
    (a, b) =>
      b.last_created_at.localeCompare(a.last_created_at) || a.user_id.localeCompare(b.user_id),
  );
  return {
    mine: sorted.find((g) => g.user_id === myUserId) ?? null,
    unwatched: sorted.filter((g) => g.user_id !== myUserId && g.has_unwatched),
    watched: sorted.filter((g) => g.user_id !== myUserId && !g.has_unwatched),
  };
}
export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}
export function validSlug(value: string) {
  return /^[a-z0-9-]{3,50}$/.test(value);
}
