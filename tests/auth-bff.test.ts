import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Context } from "@netlify/functions";
import {
  buildSetCookie,
  parseCookies,
  REDIRECT_COOKIE,
} from "../netlify/functions/_lib/cookies.ts";
import { safeRedirect } from "../netlify/functions/_lib/cors.ts";
import { resendGrant, validResend } from "../netlify/functions/_lib/resend.ts";
import backup, { allowAttempt } from "../netlify/functions/auth-backup-code-verify.ts";
import callback from "../netlify/functions/auth-callback.ts";
import logout from "../netlify/functions/auth-logout.ts";
import refresh from "../netlify/functions/auth-refresh.ts";
import signin from "../netlify/functions/auth-signin.ts";

process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_ANON_KEY = "test-anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-only";
process.env.SITE_URL = "https://silverchat.test";
process.env.ALLOWED_ORIGINS = "https://silverchat.test";
process.env.TURNSTILE_SECRET_KEY = "test-turnstile";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const userId = "11111111-1111-4111-8111-111111111111";
const factorId = "22222222-2222-4222-8222-222222222222";
const challengeId = "33333333-3333-4333-8333-333333333333";
const user = {
  id: userId,
  email: "person@example.test",
  aud: "authenticated",
  role: "authenticated",
  factors: [{ id: factorId, status: "verified", factor_type: "totp" }],
  user_metadata: {},
  app_metadata: {},
};
function token(aal: string) {
  return `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: userId, aal, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })).toString("base64url")}.testsignature`;
}
function session(aal = "aal1", refresh_token = "rotated-first") {
  return {
    access_token: token(aal),
    refresh_token,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user,
  };
}
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function request(path: string, body: unknown = {}, cookie = true, authorization = false) {
  return new Request(`https://silverchat.test/api/auth/${path}`, {
    method: "POST",
    headers: {
      Origin: "https://silverchat.test",
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: "sb-refresh-token=original-refresh" } : {}),
      ...(authorization ? { Authorization: `Bearer ${token("aal1")}` } : {}),
    },
    body: JSON.stringify(body),
  });
}
const context = { ip: "192.0.2.1" } as Context;

test("cookie flags and parser preserve encoded values and ignore malformed values", () => {
  const value = buildSetCookie("sb-refresh-token", "a=b%", 604800);
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=604800"])
    assert.ok(value.includes(flag));
  assert.equal(parseCookies(value)["sb-refresh-token"], "a=b%");
  assert.equal(parseCookies("bad=%ZZ; good=ok").good, "ok");
});
test("redirects preserve local query/hash but reject external and auth destinations", () => {
  assert.equal(safeRedirect("/chats/thread?tab=media#last"), "/chats/thread?tab=media#last");
  for (const path of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/auth/login",
    "/api/auth/logout",
    "/chats\n",
  ])
    assert.equal(safeRedirect(path), "/chats");
});
test("refresh rejects missing/hostile origins before any upstream call", async () => {
  globalThis.fetch = async () => {
    throw new Error("must not reach upstream");
  };
  for (const origin of ["null", "https://evil.test", "https://silverchat.test.evil.test", ""]) {
    const req = request("refresh");
    if (origin) req.headers.set("Origin", origin);
    else req.headers.delete("Origin");
    assert.equal((await refresh(req)).status, 403);
  }
});
test("refresh requires POST and a refresh cookie", async () => {
  const get = new Request("https://silverchat.test/api/auth/refresh", {
    headers: { Origin: "https://silverchat.test" },
  });
  assert.equal((await refresh(get)).status, 405);
  const missing = await refresh(request("refresh", {}, false));
  assert.equal(missing.status, 401);
  assert.equal((await missing.json()).error, "no_session");
});
test("normal refresh rotates cookie and flags pending MFA", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/token?")) return response(session());
    if (url.endsWith("/user")) return response(user);
    if (url.endsWith("/challenge"))
      return response({ id: challengeId, type: "totp", expires_at: Date.now() + 300000 });
    throw new Error(`Unexpected mock path: ${url}`);
  };
  const result = await refresh(request("refresh"));
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.mfaRequired, true);
  assert.equal(body.mfaChallengeId, challengeId);
  assert.ok(result.headers.get("set-cookie")?.includes("rotated-first"));
  assert.equal(body.refresh_token, undefined);
});
test("TOTP challenge uses refreshed session, returns AAL2, and sets the NEW verify cookie", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/token?")) {
      assert.equal(JSON.parse(String(init?.body)).refresh_token, "original-refresh");
      return response(session());
    }
    if (url.endsWith("/challenge")) {
      assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${token("aal1")}`);
      return response({ id: challengeId, type: "totp" });
    }
    if (url.endsWith("/verify")) {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.code, "123456");
      assert.equal(body.challenge_id, challengeId);
      return response(session("aal2", "upgraded-aal2-refresh"));
    }
    if (url.endsWith("/user")) return response(user);
    throw new Error(`Unexpected mock path: ${url}`);
  };
  const result = await refresh(request("refresh", { totp_code: "123456", factor_id: factorId }));
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.aal, "aal2");
  assert.equal(body.mfaRequired, false);
  assert.ok(result.headers.get("set-cookie")?.includes("upgraded-aal2-refresh"));
  assert.ok(!JSON.stringify(body).includes("upgraded-aal2-refresh"));
  assert.equal(calls.filter((url) => url.endsWith("/challenge")).length, 1);
});
test("invalid TOTP returns 401 without clearing rotated session cookie", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/token?")) return response(session());
    if (url.endsWith("/challenge")) return response({ id: challengeId, type: "totp" });
    if (url.endsWith("/verify"))
      return response({ code: "mfa_verification_failed", msg: "Invalid code" }, 422);
    throw new Error(`Unexpected mock path: ${url}`);
  };
  const result = await refresh(request("refresh", { totp_code: "000000", factor_id: factorId }));
  assert.equal(result.status, 401);
  assert.deepEqual(await result.json(), { error: "invalid_totp" });
  assert.ok(result.headers.get("set-cookie")?.includes("rotated-first"));
  assert.ok(!result.headers.get("set-cookie")?.includes("Max-Age=0"));
});
test("AAL2 survives an ordinary refresh without requiring TOTP again", async () => {
  globalThis.fetch = async (input) =>
    String(input).endsWith("/user") ? response(user) : response(session("aal2", "next-aal2"));
  const result = await refresh(request("refresh"));
  const body = await result.json();
  assert.equal(body.aal, "aal2");
  assert.equal(body.mfaRequired, false);
  assert.equal(body.mfaChallengeId, null);
});
test("expired refresh clears cookie; malformed TOTP does not", async () => {
  globalThis.fetch = async () =>
    response({ error_code: "refresh_token_not_found", msg: "Invalid refresh token" }, 400);
  const expired = await refresh(request("refresh"));
  assert.equal(expired.status, 401);
  assert.ok(expired.headers.get("set-cookie")?.includes("Max-Age=0"));
  const malformed = await refresh(request("refresh", { totp_code: "x", factor_id: factorId }));
  assert.equal(malformed.status, 400);
  assert.equal(malformed.headers.get("set-cookie"), null);
});
test("callback validates missing tokens and untrusted Origin", async () => {
  assert.ok(
    (await callback(new Request("https://silverchat.test/api/auth/callback"))).headers
      .get("location")
      ?.endsWith("missing_token"),
  );
  assert.equal(
    (
      await callback(
        new Request("https://silverchat.test/api/auth/callback?code=test", {
          headers: { Origin: "https://evil.test" },
        }),
      )
    ).status,
    403,
  );
});
test("token-hash callback sets cookie, no-store, and preserves safe destination", async () => {
  globalThis.fetch = async () => response(session());
  const result = await callback(
    new Request(
      "https://silverchat.test/api/auth/callback?token_hash=test&type=email&redirect=%2Fchats%3Ftab%3Dmedia",
      { headers: { Cookie: `${REDIRECT_COOKIE}=${encodeURIComponent("/chats?tab=media")}` } },
    ),
  );
  assert.equal(result.status, 303);
  const location = new URL(result.headers.get("location") ?? "");
  assert.equal(location.pathname, "/auth/post-login");
  assert.equal(location.searchParams.get("redirect"), "/chats?tab=media");
  assert.ok(result.headers.get("set-cookie")?.includes("rotated-first"));
  assert.equal(result.headers.get("referrer-policy"), "no-referrer");
  assert.equal(result.headers.get("cache-control"), "no-store");
});
test("login disables user creation, no captcha; unknown email remains uniform", async () => {
  globalThis.fetch = async (_input, init) => {
    assert.equal(JSON.parse(String(init?.body)).create_user, false);
    return response({ msg: "Signups not allowed", code: "signup_disabled" }, 422);
  };
  const result = await signin(
    request("signin", { email: "absent@example.test", mode: "login" }),
    context,
  );
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true });
});
test("signup fails without captcha, before sending an email", async () => {
  globalThis.fetch = async () => {
    throw new Error("must not send email");
  };
  assert.equal(
    (await signin(request("signin", { email: "new@example.test", mode: "signup" }), context))
      .status,
    400,
  );
});
test("signup validates Turnstile action/hostname and sets a signed resend grant", async () => {
  globalThis.fetch = async (input, init) => {
    if (String(input).includes("cloudflare"))
      return response({ success: true, hostname: "silverchat.test", action: "signup" });
    assert.equal(JSON.parse(String(init?.body)).create_user, true);
    return response({});
  };
  const result = await signin(
    request("signin", { email: "new@example.test", mode: "signup", turnstileToken: "verified" }),
    context,
  );
  assert.equal(result.status, 200);
  assert.ok(result.headers.get("set-cookie")?.includes("sb-resend="));
});
test("resend grant is bound to the captcha-verified email and rejects tampering", () => {
  const grant = resendGrant("first@example.test");
  assert.equal(validResend(grant, "first@example.test"), true);
  assert.equal(validResend(grant, "other@example.test"), false);
  assert.equal(validResend(`${grant}x`, "first@example.test"), false);
});
test("backup recovery requires authenticated email ownership, not a body email", async () => {
  globalThis.fetch = async () => {
    throw new Error("must not use admin API");
  };
  const result = await backup(
    request(
      "backup-code-verify",
      { email: "victim@example.test", code: "ABCDEFGHIJ", mfaChallengeId: challengeId },
      false,
    ),
    context,
  );
  assert.equal(result.status, 401);
});
test("backup limiter permits five attempts and resets after 15 minutes", () => {
  for (let n = 0; n < 5; n++) assert.equal(allowAttempt("192.0.2.12", 1000), true);
  assert.equal(allowAttempt("192.0.2.12", 2000), false);
  assert.equal(allowAttempt("192.0.2.12", 901001), true);
});
test("logout passes access JWT, not user ID, and uses local scope", async () => {
  let called = false;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith("/user")) return response(user);
    assert.ok(String(input).includes("scope=local"));
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${token("aal1")}`);
    called = true;
    return new Response(null, { status: 204 });
  };
  const result = await logout(request("logout", {}, true, true));
  assert.equal(result.status, 200);
  assert.equal(called, true);
  assert.ok(result.headers.get("set-cookie")?.includes("Max-Age=0"));
});

test("PKCE callback exchanges the same browser verifier with default email templates", async () => {
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.auth_code, "email-code");
    assert.equal(body.code_verifier, "browser-verifier");
    return response(session());
  };
  const result = await callback(
    new Request("https://silverchat.test/api/auth/callback?code=email-code", {
      headers: {
        Cookie: `sb-pkce-code-verifier=base64-${Buffer.from(JSON.stringify("browser-verifier")).toString("base64url")}`,
      },
    }),
  );
  assert.equal(result.status, 303);
  assert.ok(result.headers.get("location")?.includes("/auth/post-login?at="));
});
test("concurrent backup redemption deletes factors only for the atomic winner", async () => {
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256").update("ABCDEFGHIJ").digest("hex");
  let used = false;
  let deletions = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/user")) return response(user);
    if (url.includes("/rest/v1/two_factor_backup_codes")) return response([{ code_hash: hash }]);
    if (url.endsWith("/rpc/consume_backup_code")) {
      const data = JSON.parse(String(init?.body));
      assert.equal(data.p_user_id, userId);
      assert.equal(data.p_challenge_id, challengeId);
      const winner = !used;
      used = true;
      return response(winner);
    }
    if (url.endsWith(`/admin/users/${userId}/factors`) && init?.method === "GET")
      return response([{ id: factorId }]);
    if (url.endsWith(`/admin/users/${userId}/factors/${factorId}`)) {
      deletions++;
      return response({});
    }
    if (url.endsWith(`/admin/users/${userId}`)) return response(user);
    throw new Error(`Unexpected mock path: ${url}`);
  };
  const body = { code: "ABCDEFGHIJ", mfaChallengeId: challengeId };
  const results = await Promise.all([
    backup(request("backup-code-verify", body, true, true), { ip: "192.0.2.80" } as Context),
    backup(request("backup-code-verify", body, true, true), { ip: "192.0.2.81" } as Context),
  ]);
  const payloads = await Promise.all(results.map((result) => result.json()));
  assert.equal(payloads.filter((payload) => payload.success).length, 1);
  assert.equal(deletions, 1);
});
test("global logout uses JWT and global scope after MFA", async () => {
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/user")) return response(user);
    assert.ok(String(input).includes("scope=global"));
    return new Response(null, { status: 204 });
  };
  const req = request("logout-all", { scope: "global" }, true, true);
  req.headers.set("authorization", `Bearer ${token("aal2")}`);
  assert.equal((await logout(req)).status, 200);
});

test("enrollment preserves the cookie session and returns the QR setup material", async () => {
  const withoutFactors = { ...user, factors: [] };
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/token?")) return response({ ...session(), user: withoutFactors });
    if (url.endsWith("/user")) return response(withoutFactors);
    if (url.includes("/rest/v1/two_factor_backup_codes")) {
      assert.equal(init?.method, "DELETE");
      return response([]);
    }
    if (url.endsWith("/factors") && init?.method === "POST")
      return response({
        id: factorId,
        type: "totp",
        totp: { qr_code: "<svg></svg>", secret: "setup-key", uri: "otpauth://totp/test" },
      });
    throw new Error(`Unexpected mock path: ${url}`);
  };
  const result = await refresh(request("refresh", { action: "enroll" }));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).enrollment.id, factorId);
  assert.ok(result.headers.get("set-cookie")?.includes("rotated-first"));
});
test("backup regeneration requires fresh TOTP and submits ten hashes atomically", async () => {
  const hashes = Array.from({ length: 10 }, (_, index) => index.toString(16).repeat(64));
  let replaced = false;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/token?")) return response(session("aal2"));
    if (url.endsWith("/user")) return response(user);
    if (url.endsWith("/challenge")) return response({ id: challengeId, type: "totp" });
    if (url.endsWith("/verify")) return response(session("aal2", "freshly-verified"));
    if (url.endsWith("/rpc/replace_backup_codes")) {
      assert.deepEqual(JSON.parse(String(init?.body)), { p_user_id: userId, p_hashes: hashes });
      replaced = true;
      return response(null);
    }
    throw new Error(`Unexpected mock path: ${url}`);
  };
  const denied = await refresh(
    request("refresh", { action: "replace_backups", backup_hashes: hashes }),
  );
  assert.equal(denied.status, 403);
  assert.equal(replaced, false);
  const allowed = await refresh(
    request("refresh", {
      action: "replace_backups",
      totp_code: "123456",
      factor_id: factorId,
      backup_hashes: hashes,
    }),
  );
  assert.equal(allowed.status, 200);
  assert.equal(replaced, true);
});

test("sign out others preserves current cookie and sends JWT with others scope", async () => {
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/user")) return response(user);
    assert.ok(String(input).includes("scope=others"));
    return new Response(null, { status: 204 });
  };
  const req = request("logout-all", { scope: "others" }, true, true);
  req.headers.set("Authorization", `Bearer ${token("aal2")}`);
  const result = await logout(req);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("set-cookie"), null);
});
test("failed other-device revocation never clears current cookie", async () => {
  globalThis.fetch = async (input) =>
    String(input).endsWith("/user") ? response(user) : response({ message: "unavailable" }, 503);
  const req = request("logout-all", { scope: "others" }, true, true);
  req.headers.set("Authorization", `Bearer ${token("aal2")}`);
  const result = await logout(req);
  assert.equal(result.status, 503);
  assert.equal(result.headers.get("set-cookie"), null);
});
test("pending MFA cannot revoke other sessions", async () => {
  globalThis.fetch = async (input) => {
    assert.ok(String(input).endsWith("/user"));
    return response(user);
  };
  const result = await logout(request("logout-all", { scope: "others" }, true, true));
  assert.equal(result.status, 403);
  assert.equal(result.headers.get("set-cookie"), null);
});
test("refresh registers a fingerprint without persisting tokens", async () => {
  let registered = false;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/token")) return response(session("aal2"));
    if (url.endsWith("/user")) return response(user);
    assert.ok(url.includes("/devices"));
    const body = JSON.parse(String(init?.body));
    assert.equal(body.user_id, userId);
    assert.equal(body.device_fingerprint, challengeId);
    assert.equal(body.device_name, "Test browser");
    assert.equal(body.access_token, undefined);
    assert.equal(body.refresh_token, undefined);
    assert.ok(url.includes("on_conflict=user_id%2Cdevice_fingerprint"));
    registered = true;
    return response(null, 201);
  };
  assert.equal(
    (
      await refresh(
        request("refresh", { device_fingerprint: challengeId, device_name: "Test browser" }),
      )
    ).status,
    200,
  );
  assert.ok(registered);
});
test("email change uses refreshed cookie session and returns only public session", async () => {
  let changed = false;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/token")) return response(session("aal2"));
    if (init?.method === "PUT") {
      assert.ok(url.includes("/user"));
      assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${token("aal2")}`);
      assert.equal(JSON.parse(String(init.body)).email, "new@example.test");
      assert.ok(url.includes("redirect_to="));
      changed = true;
      return response({ ...user, new_email: "new@example.test" });
    }
    return response(user);
  };
  const result = await refresh(
    request("refresh", { action: "change_email", email: "new@example.test" }),
  );
  assert.equal(result.status, 200);
  assert.ok(changed);
  assert.ok(result.headers.get("set-cookie")?.includes("rotated-first"));
  const body = await result.json();
  assert.equal(body.refresh_token, undefined);
  assert.equal(body.user.email, user.email);
});
test("pending MFA cannot change email", async () => {
  globalThis.fetch = async (input, init) => {
    assert.notEqual(init?.method, "PUT");
    return String(input).includes("/token") ? response(session()) : response(user);
  };
  assert.equal(
    (await refresh(request("refresh", { action: "change_email", email: "new@example.test" })))
      .status,
    403,
  );
});

test("login, signup and signed resend use the exact callback URL and a consumed destination cookie", async () => {
  const email = "redirect@example.test";
  const destination = "/chats?tab=media#last";
  for (const mode of ["login", "signup", "resend"] as const) {
    let requestedCallback = "";
    let captchaCalls = 0;
    let verifier = "";
    let issuedAccessToken = "";
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname === "challenges.cloudflare.com") {
        captchaCalls++;
        return response({ success: true, hostname: "silverchat.test", action: "signup" });
      }
      if (url.pathname.endsWith("/otp")) {
        requestedCallback = url.searchParams.get("redirect_to") ?? "";
        assert.equal(requestedCallback, "https://silverchat.test/api/auth/callback");
        assert.equal(new URL(requestedCallback).search, "");
        const body = JSON.parse(String(init?.body));
        assert.equal(body.create_user, mode !== "login");
        assert.equal(body.code_challenge_method, "s256");
        return response({});
      }
      assert.equal(url.searchParams.get("grant_type"), "pkce");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.auth_code, "email-code");
      assert.equal(body.code_verifier, verifier);
      const issued = session();
      issuedAccessToken = issued.access_token;
      return response(issued);
    };
    const req = request("signin", {
      email,
      mode,
      redirect: destination,
      ...(mode === "signup" ? { turnstileToken: "verified" } : {}),
    });
    const grant = resendGrant(email);
    if (mode === "resend") req.headers.set("Cookie", `sb-resend=${encodeURIComponent(grant)}`);
    const sent = await signin(req, context);
    assert.equal(sent.status, 200);
    assert.equal(captchaCalls, mode === "signup" ? 1 : 0);
    const cookies = sent.headers.getSetCookie();
    const destinationCookie = cookies.find((value) => value.startsWith(`${REDIRECT_COOKIE}=`));
    assert.ok(destinationCookie);
    assert.equal(parseCookies(destinationCookie)[REDIRECT_COOKIE], destination);
    for (const flag of ["Path=/", "HttpOnly", "Secure", "SameSite=Lax", "Max-Age=600"])
      assert.ok(destinationCookie.includes(flag));
    const resendCookie = cookies.find((value) => value.startsWith("sb-resend="));
    if (mode === "signup")
      assert.ok(validResend(parseCookies(resendCookie ?? null)["sb-resend"], email));
    else assert.equal(resendCookie, undefined);
    const cookieHeader = cookies.map((value) => value.split(";")[0]).join("; ");
    const encodedVerifier = parseCookies(cookieHeader)["sb-pkce-code-verifier"] ?? "";
    assert.ok(encodedVerifier.startsWith("base64-"));
    verifier = JSON.parse(Buffer.from(encodedVerifier.slice(7), "base64url").toString());
    const result = await callback(
      new Request(`${requestedCallback}?code=email-code&redirect=/settings`, {
        headers: { Cookie: cookieHeader },
      }),
    );
    assert.equal(result.status, 303);
    const final = new URL(result.headers.get("location") ?? "");
    assert.equal(final.pathname, "/auth/post-login");
    assert.equal(final.searchParams.get("redirect"), destination);
    assert.equal(final.searchParams.get("at"), issuedAccessToken);
    assert.ok(result.headers.getSetCookie().includes(clearRedirectCookie()));
    assert.ok(
      result.headers
        .getSetCookie()
        .some((value) => value.startsWith("sb-refresh-token=rotated-first;")),
    );
  }
});
function clearRedirectCookie() {
  return buildSetCookie(REDIRECT_COOKIE, "", 0);
}
test("callback defaults missing, malformed or unsafe destination cookies to chats and ignores URL destinations", async () => {
  globalThis.fetch = async () => response(session());
  for (const value of [
    undefined,
    "",
    "%ZZ",
    encodeURIComponent("https://evil.test"),
    encodeURIComponent("//evil.test"),
    encodeURIComponent("/auth/login"),
    encodeURIComponent("/api/auth/logout"),
    encodeURIComponent("/chats\n"),
  ]) {
    const result = await callback(
      new Request(
        "https://silverchat.test/api/auth/callback?token_hash=test&type=email&redirect=/settings",
        {
          headers: value === undefined ? {} : { Cookie: `${REDIRECT_COOKIE}=${value}` },
        },
      ),
    );
    assert.equal(result.status, 303);
    assert.equal(
      new URL(result.headers.get("location") ?? "").searchParams.get("redirect"),
      "/chats",
    );
    assert.ok(result.headers.getSetCookie().includes(clearRedirectCookie()));
  }
});
test("callback clears the destination cookie for missing, invalid, expired and rejected requests", async () => {
  const cookie = `${REDIRECT_COOKIE}=${encodeURIComponent("/settings")}`;
  const cases = [
    { path: "", method: "GET", status: 303, error: "missing_token" },
    { path: "?token_hash=test&type=recovery", method: "GET", status: 303, error: "missing_token" },
    { path: "?token_hash=test&type=email", method: "GET", status: 303, error: "invalid_token" },
    { path: "?token_hash=expired&type=email", method: "GET", status: 303, error: "expired_token" },
    { path: "?code=test", method: "POST", status: 405, error: null },
    { path: "?code=test", method: "GET", status: 403, error: null, origin: "https://evil.test" },
  ];
  globalThis.fetch = async (_input, init) => {
    const result = response(
      {
        code:
          JSON.parse(String(init?.body)).token_hash === "expired" ? "otp_expired" : "otp_disabled",
        msg: "Invalid or expired token",
      },
      403,
    );
    result.headers.set("x-supabase-api-version", "2024-01-01");
    return result;
  };
  for (const sample of cases) {
    const result = await callback(
      new Request(`https://silverchat.test/api/auth/callback${sample.path}`, {
        method: sample.method,
        headers: { Cookie: cookie, ...(sample.origin ? { Origin: sample.origin } : {}) },
      }),
    );
    assert.equal(result.status, sample.status);
    if (sample.error)
      assert.equal(
        new URL(result.headers.get("location") ?? "").searchParams.get("code"),
        sample.error,
      );
    assert.ok(result.headers.getSetCookie().includes(clearRedirectCookie()));
    assert.equal(
      result.headers.getSetCookie().some((value) => value.startsWith("sb-refresh-token=")),
      false,
    );
    assert.equal(result.headers.get("cache-control"), "no-store");
  }
});
test("signin sanitizes an external destination before storing the cookie", async () => {
  globalThis.fetch = async (input) => {
    assert.equal(
      new URL(String(input)).searchParams.get("redirect_to"),
      "https://silverchat.test/api/auth/callback",
    );
    return response({});
  };
  const result = await signin(
    request("signin", { email: "person@example.test", redirect: "https://evil.test" }),
    context,
  );
  const cookie = result.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${REDIRECT_COOKIE}=`));
  assert.equal(parseCookies(cookie ?? null)[REDIRECT_COOKIE], "/chats");
});
