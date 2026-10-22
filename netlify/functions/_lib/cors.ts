export function verifyOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const allowed = process.env.ALLOWED_ORIGINS?.split(",").map((item) => item.trim()) ?? [];
  return !!origin && origin !== "null" && allowed.includes(origin);
}
export function json(data: unknown, status = 200, headers = new Headers()): Response {
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(JSON.stringify(data), { status, headers });
}
export function guard(req: Request): Response | null {
  if (!verifyOrigin(req)) return json({ error: "forbidden_origin" }, 403);
  if (req.method !== "POST")
    return json({ error: "method_not_allowed" }, 405, new Headers({ Allow: "POST" }));
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return json({ error: "invalid_content_type" }, 415);
  return null;
}
export function safeRedirect(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    [...value].some((character) => character.charCodeAt(0) <= 32) ||
    value.includes("\\")
  )
    return "/chats";
  const url = new URL(value, "https://silverchat.invalid");
  if (
    url.origin !== "https://silverchat.invalid" ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/api")
  )
    return "/chats";
  return `${url.pathname}${url.search}${url.hash}`;
}
