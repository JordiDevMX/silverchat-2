import { buildSetCookie, COOKIE_MAX_AGE, REFRESH_COOKIE } from "./_lib/cookies.ts";
import { safeRedirect, verifyOrigin } from "./_lib/cors.ts";
import { anonClient, pkceClient, required } from "./_lib/supabase-admin.ts";
export default async function handler(req: Request): Promise<Response> {
  const headers = new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  const redirect = (path: string) => {
    headers.set("Location", new URL(path, required("SITE_URL")).href);
    return new Response(null, { status: 303, headers });
  };
  if (req.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });
  // Email navigations have no Origin. Validate it when supplied; POSTs always require it.
  if (req.headers.has("origin") && !verifyOrigin(req)) return new Response(null, { status: 403 });
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (!code && (!hash || !["email", "signup", "magiclink", "email_change"].includes(type ?? "")))
    return redirect("/auth/error?code=missing_token");
  try {
    const result = code
      ? await pkceClient(req, headers).auth.exchangeCodeForSession(code)
      : await anonClient().auth.verifyOtp({
          token_hash: hash ?? "",
          type: type as "email" | "signup" | "magiclink" | "email_change",
        });
    if (result.error || !result.data.session)
      return redirect(
        `/auth/error?code=${result.error?.code === "otp_expired" ? "expired_token" : "invalid_token"}`,
      );
    const session = result.data.session;
    headers.append(
      "Set-Cookie",
      buildSetCookie(REFRESH_COOKIE, session.refresh_token, COOKIE_MAX_AGE),
    );
    const search = new URLSearchParams({
      at: session.access_token,
      redirect: safeRedirect(url.searchParams.get("redirect")),
    });
    return redirect(`/auth/post-login?${search}`);
  } catch {
    return redirect("/auth/error?code=unknown");
  }
}
