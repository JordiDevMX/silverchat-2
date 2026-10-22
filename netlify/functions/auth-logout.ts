import { clearCookie, REFRESH_COOKIE } from "./_lib/cookies.ts";
import { guard, json } from "./_lib/cors.ts";
import { adminClient, assurance, authenticated } from "./_lib/supabase-admin.ts";
export default async function handler(req: Request): Promise<Response> {
  const denied = guard(req);
  if (denied) return denied;
  const headers = new Headers();
  try {
    const auth = await authenticated(req);
    const body = await req.json().catch(() => ({}));
    if (![undefined, "local", "global", "all", "others"].includes(body.scope))
      return json({ error: "invalid_request" }, 400);
    const scope =
      body.scope === "others"
        ? "others"
        : body.scope === "global" || body.scope === "all"
          ? "global"
          : "local";
    if (scope !== "others") headers.set("Set-Cookie", clearCookie(REFRESH_COOKIE));
    if (!auth) return json({ error: "no_session" }, 401, headers);
    if (
      scope !== "local" &&
      auth.user.factors?.some((f) => f.status === "verified") &&
      assurance(auth.token) !== "aal2"
    )
      return json({ error: "mfa_required" }, 403);
    const { error } = await adminClient().auth.admin.signOut(auth.token, scope);
    if (error) return json({ error: "logout_failed" }, 503, headers);
    return json({ ok: true }, 200, headers);
  } catch {
    return json({ error: "logout_failed" }, 503, headers);
  }
}
