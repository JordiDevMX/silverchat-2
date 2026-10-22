import { required } from "./supabase-admin.ts";

// Official Cloudflare Turnstile testing secrets. When one is configured, widget
// responses are dummy tokens that siteverify accepts (success: true) but echo
// hostname "example.com" and no `action`, so the hostname/action checks below
// cannot be satisfied. Only testing is relaxed; production keys still require
// the echoes.
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const TEST_SECRETS = new Set([
  "1x0000000000000000000000000000000AA", // always passes
  "2x0000000000000000000000000000000AA", // always fails
  "3x0000000000000000000000000000000AA", // always fails
]);

export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = required("TURNSTILE_SECRET_KEY");
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({
      secret,
      response: token,
      ...(ip ? { remoteip: ip } : {}),
    }),
  });
  if (!response.ok) return false;
  const data = (await response.json()) as { success: boolean; hostname?: string; action?: string };
  if (TEST_SECRETS.has(secret) && data.success === true) return true;
  return (
    data.success === true &&
    data.hostname === new URL(required("SITE_URL")).hostname &&
    data.action === "signup"
  );
}
