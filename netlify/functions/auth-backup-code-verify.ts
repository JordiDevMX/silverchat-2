import { createHash, timingSafeEqual } from "node:crypto";
import type { Context } from "@netlify/functions";
import { z } from "zod";
import { guard, json } from "./_lib/cors.ts";
import { adminClient, authenticated } from "./_lib/supabase-admin.ts";

const attempts = new Map<string, { count: number; expires: number }>();
export function allowAttempt(ip: string, now = Date.now()): boolean {
  for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
  const current = attempts.get(ip) ?? { count: 0, expires: now + 900_000 };
  if (current.count >= 5 || (!attempts.has(ip) && attempts.size >= 10_000)) return false;
  current.count++;
  attempts.set(ip, current);
  return true;
}
const schema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{10}$/),
  mfaChallengeId: z.uuid(),
});
export default async function handler(req: Request, context: Context): Promise<Response> {
  const denied = guard(req);
  if (denied) return denied;
  if (!allowAttempt(context.ip ?? "unknown"))
    return json({ success: false, error: "rate_limited" }, 429);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ success: false }, 400);
  try {
    // An email in the body is NOT proof of email ownership. Require a verified login JWT.
    const auth = await authenticated(req);
    if (!auth) return json({ success: false }, 401);
    const admin = adminClient();
    const { data: codes, error } = await admin
      .from("two_factor_backup_codes")
      .select("code_hash")
      .eq("user_id", auth.user.id)
      .is("used_at", null);
    if (error) return json({ success: false, error: "recovery_unavailable" }, 503);
    const hash = createHash("sha256").update(parsed.data.code).digest("hex");
    let found = false;
    for (const code of codes ?? []) {
      const candidate = Buffer.from(code.code_hash, "hex");
      const submitted = Buffer.from(hash, "hex");
      if (candidate.length === submitted.length && timingSafeEqual(candidate, submitted))
        found = true;
    }
    if (!found) return json({ success: false });
    const consumed = await admin.rpc("consume_backup_code", {
      p_user_id: auth.user.id,
      p_code_hash: hash,
      p_challenge_id: parsed.data.mfaChallengeId,
    });
    if (consumed.error) return json({ success: false, error: "recovery_unavailable" }, 503);
    if (!consumed.data) return json({ success: false });
    const factors = await admin.auth.admin.mfa.listFactors({ userId: auth.user.id });
    if (factors.error) return json({ success: false, error: "recovery_incomplete" }, 503);
    for (const factor of factors.data.factors) {
      const result = await admin.auth.admin.mfa.deleteFactor({
        userId: auth.user.id,
        id: factor.id,
      });
      if (result.error) return json({ success: false, error: "recovery_incomplete" }, 503);
    }
    const marked = await admin.auth.admin.updateUserById(auth.user.id, {
      user_metadata: { ...auth.user.user_metadata, requires_reenrollment: true },
    });
    if (marked.error) return json({ success: false, error: "recovery_incomplete" }, 503);
    return json({ success: true, requires_reenrollment: true });
  } catch {
    return json({ success: false, error: "recovery_unavailable" }, 503);
  }
}
