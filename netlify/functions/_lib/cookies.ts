export const REFRESH_COOKIE = "sb-refresh-token";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export function buildSetCookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}
export function clearCookie(name: string) {
  return buildSetCookie(name, "", 0);
}
export function parseCookies(header: string | null): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  for (const part of header?.split(";") ?? []) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    try {
      result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1));
    } catch {
      /* Ignore malformed cookies rather than failing the request. */
    }
  }
  return result;
}
