import { z } from "zod";
import {
  buildSetCookie,
  COOKIE_MAX_AGE,
  clearCookie,
  parseCookies,
  REFRESH_COOKIE,
} from "./_lib/cookies.ts";
import { guard, json } from "./_lib/cors.ts";
import {
  adminClient,
  anonClient,
  assurance,
  publicSession,
  required,
} from "./_lib/supabase-admin.ts";

const schema = z
  .object({
    totp_code: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    factor_id: z.uuid().optional(),
    action: z
      .enum(["refresh", "enroll", "disable", "replace_backups", "change_email"])
      .default("refresh"),
    email: z.email().max(254).optional(),
    device_fingerprint: z.uuid().nullable().optional(),
    device_name: z.string().max(80).optional(),
    backup_hashes: z
      .array(z.string().regex(/^[a-f0-9]{64}$/))
      .length(10)
      .optional(),
  })
  .refine((data) => !data.totp_code || !!data.factor_id);
// supabase-js auth calls accept no signal; race the refresh so a hung GoTrue
// returns a fast 503 instead of holding the Lambda until the 30s limit.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("auth_refresh_timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
export default async function handler(req: Request): Promise<Response> {
  const denied = guard(req);
  if (denied) return denied;
  const text = await req.text();
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid_request" }, 400);
  const body = parsed.data;
  const cookie = parseCookies(req.headers.get("cookie"))[REFRESH_COOKIE];
  if (!cookie) return json({ error: "no_session" }, 401);
  const headers = new Headers();
  try {
    const client = anonClient();
    const { data, error } = await withTimeout(
      client.auth.refreshSession({ refresh_token: cookie }),
      10_000,
    );
    if (error || !data.session) {
      if (error && (error.status === 0 || (error.status ?? 0) >= 500))
        return json({ error: "refresh_unavailable" }, 503);
      headers.append("Set-Cookie", clearCookie(REFRESH_COOKIE));
      return json({ error: "invalid_refresh" }, 401, headers);
    }
    let session = data.session;
    const rotate = () =>
      headers.set(
        "Set-Cookie",
        buildSetCookie(REFRESH_COOKIE, session.refresh_token, COOKIE_MAX_AGE),
      );
    rotate(); // Preserve this rotation even if a subsequent TOTP attempt fails.
    if (body.totp_code && body.factor_id) {
      const challenge = await client.auth.mfa.challenge({ factorId: body.factor_id });
      if (challenge.error) return json({ error: "invalid_totp" }, 401, headers);
      const verified = await client.auth.mfa.verify({
        factorId: body.factor_id,
        challengeId: challenge.data.id,
        code: body.totp_code,
      });
      if (verified.error) return json({ error: "invalid_totp" }, 401, headers);
      session = { ...session, ...verified.data };
      rotate(); // The new AAL2 refresh token never enters the response JSON.
    }
    const { data: fresh, error: userError } = await client.auth.getUser(session.access_token);
    if (userError || !fresh.user) return json({ error: "refresh_unavailable" }, 503, headers);
    session.user = fresh.user;
    const aal = assurance(session.access_token);
    if (!publicSession(session).mfaRequired && body.device_fingerprint) {
      const registration = await adminClient()
        .from("devices")
        .upsert(
          {
            user_id: session.user.id,
            device_fingerprint: body.device_fingerprint,
            device_name: body.device_name || "Web Browser",
            device_type: "web",
            user_agent: (req.headers.get("user-agent") || "").slice(0, 1024),
            last_active_at: new Date().toISOString(),
          },
          { onConflict: "user_id,device_fingerprint" },
        );
      if (registration.error) console.error("Device registration unavailable");
    }
    if (body.action === "change_email") {
      if (publicSession(session).mfaRequired) return json({ error: "mfa_required" }, 403, headers);
      if (!body.email) return json({ error: "invalid_request" }, 400, headers);
      const updated = await client.auth.updateUser(
        { email: body.email },
        {
          emailRedirectTo: new URL(
            "/api/auth/callback?redirect=/settings/account",
            required("SITE_URL"),
          ).href,
        },
      );
      if (updated.error) return json({ error: "email_change_failed" }, 400, headers);
    }
    if (body.action === "enroll") {
      if (publicSession(session).mfaRequired) return json({ error: "mfa_required" }, 403, headers);
      if (session.user.factors?.some((factor) => factor.status === "verified")) {
        return json({ error: "already_enrolled" }, 409, headers);
      }
      const cleanup = await adminClient()
        .from("two_factor_backup_codes")
        .delete()
        .eq("user_id", session.user.id);
      if (cleanup.error) return json({ error: "backup_cleanup_failed" }, 503, headers);
      // Cancel stale, unverified enrollments from an abandoned setup.
      for (const factor of session.user.factors ?? []) {
        if (factor.status === "unverified" && factor.factor_type === "totp")
          await client.auth.mfa.unenroll({ factorId: factor.id });
      }
      const enrolled = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (enrolled.error) return json({ error: "enrollment_failed" }, 400, headers);
      return json({ ...publicSession(session), aal, enrollment: enrolled.data }, 200, headers);
    }
    if (body.action === "disable" || body.action === "replace_backups") {
      if (!body.totp_code || !body.factor_id || aal !== "aal2")
        return json({ error: "mfa_required" }, 403, headers);
      const admin = adminClient();
      if (body.action === "replace_backups") {
        if (!body.backup_hashes || new Set(body.backup_hashes).size !== 10)
          return json({ error: "invalid_request" }, 400, headers);
        const result = await admin.rpc("replace_backup_codes", {
          p_user_id: session.user.id,
          p_hashes: body.backup_hashes,
        });
        if (result.error) return json({ error: "backup_update_failed" }, 503, headers);
      } else {
        const factors = await client.auth.mfa.listFactors();
        if (factors.error) return json({ error: "disable_failed" }, 503, headers);
        for (const factor of factors.data.totp) {
          const result = await client.auth.mfa.unenroll({ factorId: factor.id });
          if (result.error) return json({ error: "disable_failed" }, 503, headers);
        }
        const deleted = await admin
          .from("two_factor_backup_codes")
          .delete()
          .eq("user_id", session.user.id);
        if (deleted.error) return json({ error: "backup_cleanup_failed" }, 503, headers);
      }
    }
    const state = publicSession(session);
    let mfaChallengeId: string | null = null;
    let factorId: string | null = null;
    if (state.mfaRequired) {
      factorId =
        session.user.factors?.find((f) => f.status === "verified" && f.factor_type === "totp")
          ?.id ?? null;
      if (factorId) {
        const challenge = await client.auth.mfa.challenge({ factorId });
        if (challenge.error) return json({ error: "challenge_failed" }, 503, headers);
        mfaChallengeId = challenge.data.id;
      }
    }
    return json({ ...state, aal, mfaChallengeId, factorId }, 200, headers);
  } catch {
    return json({ error: "refresh_unavailable" }, 503, headers);
  }
}
