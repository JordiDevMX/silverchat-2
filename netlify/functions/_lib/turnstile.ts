import { required } from "./supabase-admin.ts";
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({
      secret: required("TURNSTILE_SECRET_KEY"),
      response: token,
      ...(ip ? { remoteip: ip } : {}),
    }),
  });
  if (!response.ok) return false;
  const data = (await response.json()) as { success: boolean; hostname?: string; action?: string };
  return (
    data.success === true &&
    data.hostname === new URL(required("SITE_URL")).hostname &&
    data.action === "signup"
  );
}
