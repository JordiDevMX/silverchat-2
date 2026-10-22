import { createHmac, timingSafeEqual } from "node:crypto";
import { required } from "./supabase-admin.ts";
export const RESEND_COOKIE = "sb-resend";
function signature(value: string) {
  return createHmac("sha256", required("SUPABASE_SERVICE_ROLE_KEY"))
    .update(value)
    .digest("base64url");
}
export function resendGrant(email: string): string {
  const value = Buffer.from(JSON.stringify({ email, expires: Date.now() + 600_000 })).toString(
    "base64url",
  );
  return `${value}.${signature(value)}`;
}
export function validResend(grant: string | undefined, email: string): boolean {
  if (!grant) return false;
  const [value, sig] = grant.split(".");
  if (!value || !sig) return false;
  const expected = Buffer.from(signature(value));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  try {
    const data = JSON.parse(Buffer.from(value, "base64url").toString());
    return data.email === email && data.expires > Date.now();
  } catch {
    return false;
  }
}
