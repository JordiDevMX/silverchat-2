import { clearCookie, REFRESH_COOKIE } from "./_lib/cookies.ts";
import { guard, json } from "./_lib/cors.ts";
import { adminClient, assurance, authenticated } from "./_lib/supabase-admin.ts";
export default async function handler(req: Request): Promise<Response> {
  const denied = guard(req);
  if (denied) return denied;
  const headers = new Headers({ "Set-Cookie": clearCookie(REFRESH_COOKIE) });
  try {
    const auth = await authenticated(req);
    const body = await req.json().catch(() => ({}));
    const global = body.scope === "global" || new URL(req.url).pathname.endsWith("logout-all");
    if (!auth) return json({ error: "no_session" }, 401, headers);
    if (
      global &&
      auth.user.factors?.some((f) => f.status === "verified") &&
      assurance(auth.token) !== "aal2"
    )
      return json({ error: "mfa_required" }, 403);
    const { error } = await adminClient().auth.admin.signOut(
      auth.token,
      global ? "global" : "local",
    );
    if (error) return json({ error: "logout_failed" }, 503, headers);
    return json({ ok: true }, 200, headers);
  } catch {
    return json({ error: "logout_failed" }, 503, headers);
  }
}
