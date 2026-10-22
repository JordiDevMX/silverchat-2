export const AVATAR_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ["#8B5CF6", "#EC4899"],
  ["#3B82F6", "#06B6D4"],
  ["#10B981", "#14B8A6"],
  ["#F97316", "#EF4444"],
  ["#EC4899", "#A855F7"],
  ["#1E40AF", "#94A3B8"],
  ["#F59E0B", "#EA580C"],
  ["#84CC16", "#65A30D"],
  ["#D946EF", "#F472B6"],
  ["#06B6D4", "#3B82F6"],
  ["#DC2626", "#F97316"],
  ["#64748B", "#94A3B8"],
];
export async function getGradientForUser(userId: string): Promise<readonly [string, string]> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  return AVATAR_GRADIENTS[(new Uint8Array(hash)[0] ?? 0) % 12] ?? ["#64748B", "#94A3B8"];
}
export function getCSSGradient(colors: readonly [string, string]) {
  return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
}
export function getInitials(profile: {
  first_name?: string | null;
  last_name?: string | null;
  display_name: string;
  username: string;
}) {
  const first = Array.from(profile.first_name?.trim() ?? "");
  const last = Array.from(profile.last_name?.trim() ?? "");
  if (first.length && last.length) return `${first[0]}${last[0]}`.toUpperCase();
  if (first.length) return `${first[0]}${first.at(-1)}`.toUpperCase();
  const words = profile.display_name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1)
    return `${Array.from(words[0] ?? "")[0]}${Array.from(words.at(-1) ?? "")[0]}`.toUpperCase();
  return Array.from(words[0] || profile.username)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
