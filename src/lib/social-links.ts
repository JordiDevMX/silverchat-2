export const FIXED_PLATFORMS = [
  { key: "twitter", label: "Twitter / X", placeholder: "https://x.com/you" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/you" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/you" },
  { key: "telegram", label: "Telegram", placeholder: "https://t.me/you" },
  { key: "discord", label: "Discord", placeholder: "your#0000 or invite URL" },
] as const;
export const MAX_CUSTOM_LINKS = 20;
export const MAX_FIELD_LENGTH = 500;
export type SocialLinks = Partial<Record<(typeof FIXED_PLATFORMS)[number]["key"], string>> & {
  custom?: { label: string; url: string }[];
};
const clean = (value: unknown) =>
  typeof value === "string" ? value.trim().slice(0, MAX_FIELD_LENGTH) : "";
export function normalizeSocialLinks(input: unknown): SocialLinks {
  if (!input || typeof input !== "object") return {};
  const value = input as Record<string, unknown>;
  const out: SocialLinks = {};
  for (const { key } of FIXED_PLATFORMS) {
    const text = clean(value[key]);
    if (text) out[key] = text;
  }
  if (Array.isArray(value.custom)) {
    const custom = value.custom
      .filter((c) => c && typeof c === "object")
      .map((c) => ({ label: clean(c.label), url: clean(c.url) }))
      .filter((c) => c.label || c.url)
      .slice(0, MAX_CUSTOM_LINKS);
    if (custom.length) out.custom = custom;
  }
  return out;
}
// Saving accepts arbitrary strings. Rendering never executes an unsafe URL scheme.
export function socialHref(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
