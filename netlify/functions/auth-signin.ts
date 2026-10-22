import type { Context } from "@netlify/functions";
import { z } from "zod";
import { buildSetCookie, parseCookies, REDIRECT_COOKIE } from "./_lib/cookies.ts";
import { guard, json, safeRedirect } from "./_lib/cors.ts";
import { RESEND_COOKIE, resendGrant, validResend } from "./_lib/resend.ts";
import { pkceClient, required } from "./_lib/supabase-admin.ts";
import { verifyTurnstile } from "./_lib/turnstile.ts";

const schema = z.object({
  email: z
    .email()
    .max(254)
    .transform((s) => s.trim().toLowerCase()),
  mode: z.enum(["login", "signup", "resend"]).default("login"),
  turnstileToken: z.string().max(2048).optional(),
  redirect: z.string().max(2048).optional(),
});
export default async function handler(req: Request, context: Context): Promise<Response> {
  const denied = guard(req);
  if (denied) return denied;
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "invalid_request" }, 400);
  try {
    const { email, mode, turnstileToken, redirect } = body.data;
    const headers = new Headers();
    if (mode === "signup") {
      if (!turnstileToken || !(await verifyTurnstile(turnstileToken, context.ip)))
        return json({ error: "captcha_failed" }, 400);
      headers.append("Set-Cookie", buildSetCookie(RESEND_COOKIE, resendGrant(email), 600));
    }
    const isResend =
      mode === "resend" &&
      validResend(parseCookies(req.headers.get("cookie"))[RESEND_COOKIE], email);
    headers.append("Set-Cookie", buildSetCookie(REDIRECT_COOKIE, safeRedirect(redirect), 600));
    // Keep emailRedirectTo query-free so it matches the exact callback allowlist entry.
    const callback = new URL("/api/auth/callback", required("SITE_URL"));
    // Same outward result for unknown email, existing email, delivery failures and limits.
    await pkceClient(req, headers).auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: mode === "signup" || isResend,
        emailRedirectTo: callback.href,
      },
    });
    return json({ ok: true }, 200, headers);
  } catch {
    return json({ error: "signin_unavailable" }, 503);
  }
}
