// Run against Vite with mocked auth/data boundaries. No remote users or emails.
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const origin = process.env.UI_BASE_URL ?? "http://127.0.0.1:5175";
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(10000);
await page.clock.install();
const failures = [];
page.on("pageerror", (error) => failures.push(error.message));
let signedIn = false;
let aal = "aal1";
let factor = false;
let username = "alice";
let rejectCode = false;
let storedHashes = [];
let usedRecovery = false;
let availability = "available";
let failPreferences = false;
let savedPreferences;
let signinCalls = 0;
const id = "11111111-1111-4111-8111-111111111111";
const factorId = "22222222-2222-4222-8222-222222222222";
const challengeId = "33333333-3333-4333-8333-333333333333";
const jwt = () =>
  `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: id, aal, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
const user = () => ({
  id,
  email: "alice@example.test",
  aud: "authenticated",
  role: "authenticated",
  user_metadata: { requires_reenrollment: usedRecovery },
  app_metadata: {},
  factors: factor
    ? [
        {
          id: factorId,
          factor_type: "totp",
          status: "verified",
          friendly_name: "Authenticator app",
        },
      ]
    : [],
});
const session = () => ({
  accessToken: jwt(),
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  user: { id, email: "alice@example.test" },
  aal,
  mfaRequired: factor && aal !== "aal2",
  mfaChallengeId: factor && aal !== "aal2" ? challengeId : null,
  factorId: factor ? factorId : null,
});
const fulfill = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
await page.route("**/api/auth/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  const body = route.request().postDataJSON() ?? {};
  if (path.endsWith("/refresh")) {
    if (!signedIn) return fulfill(route, { error: "no_session" }, 401);
    if (body.action === "enroll")
      return fulfill(route, {
        ...session(),
        enrollment: {
          id: factorId,
          totp: {
            qr_code:
              '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><rect width="220" height="220" fill="white"/></svg>',
            secret: "TEST-SETUP-KEY",
            uri: "otpauth://test",
          },
        },
      });
    if (body.totp_code) {
      if (rejectCode) return fulfill(route, { error: "invalid_totp" }, 401);
      assert.equal(body.factor_id, factorId);
      aal = "aal2";
      factor = true;
    }
    if (body.action === "replace_backups") {
      assert.equal(body.backup_hashes.length, 10);
      storedHashes = body.backup_hashes;
    }
    if (body.action === "disable") factor = false;
    return fulfill(route, session());
  }
  if (path.endsWith("/backup-code-verify")) {
    assert.equal(body.mfaChallengeId, challengeId);
    factor = false;
    usedRecovery = true;
    return fulfill(route, { success: true, requires_reenrollment: true });
  }
  if (path.endsWith("/signin")) {
    signinCalls++;
    return fulfill(route, { ok: true });
  }
  if (path.endsWith("/logout")) {
    signedIn = false;
    return fulfill(route, { ok: true });
  }
  return fulfill(route, { success: true });
});
await page.route("https://supabase.test/**", async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith("/user")) return fulfill(route, user());
  if (url.pathname.endsWith("/profiles_visible"))
    return fulfill(route, availability === "taken" ? [{ id: "another-user" }] : []);
  if (url.pathname.endsWith("/profiles")) {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      if (body.username && availability === "race")
        return fulfill(route, { code: "23505", message: "duplicate" }, 409);
      if (body.username) username = body.username;
      return fulfill(route, null);
    }
    if (url.searchParams.has("username")) return fulfill(route, []);
    return fulfill(route, {
      id,
      username,
      display_name: "Alice",
      avatar_url: null,
      first_name: null,
      last_name: null,
      bio: null,
      social_links: {},
      last_seen_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
  if (url.pathname.endsWith("/two_factor_backup_codes")) {
    storedHashes = route
      .request()
      .postDataJSON()
      .map((row) => row.code_hash);
    return fulfill(route, []);
  }
  if (url.pathname.endsWith("/user_settings")) {
    if (route.request().method() === "PATCH") {
      if (failPreferences) return fulfill(route, { message: "save failed" }, 400);
      savedPreferences = route.request().postDataJSON();
    }
    return fulfill(route, savedPreferences ?? { theme: "system", accent: "blue", language: "en" });
  }
  return fulfill(route, []);
});
try {
  await page.goto(`${origin}/`);
  await page.getByRole("heading", { name: "Good conversations need their own space." }).waitFor();
  console.log("PASS landing and desktop render");
  await page.goto(`${origin}/auth/signup`);
  await page.getByRole("heading", { name: "Create your account" }).waitFor();
  assert.ok(await page.getByRole("button", { name: "Create account", exact: true }).isDisabled());
  await page
    .getByText("Account creation is temporarily unavailable. Please try again later.")
    .waitFor();
  assert.equal(signinCalls, 0);
  await page.goto(`${origin}/auth/login?redirect=https%3A%2F%2Fevil.test`);
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(signinCalls, 0, "invalid email does not send");
  await page.getByLabel("Email address").fill("alice@example.test");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("redirect"), "/chats");
  await page.clock.runFor(61_000);
  await page.getByRole("button", { name: "Resend email", exact: true }).click();
  await page.getByText("Email sent again. Check your inbox.").waitFor();
  assert.ok(await page.getByRole("button", { name: /Resend in/ }).isDisabled());
  for (const [path, title] of [
    ["/auth/error?code=expired_token", "This link has expired."],
    ["/missing-route", "Page not found"],
  ]) {
    await page.goto(origin + path);
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
  }
  console.log(
    "PASS signup CAPTCHA requirement, validation, unsafe redirect, resend and error/not-found recovery",
  );
  await page.goto(`${origin}/chats?tab=media#last`);
  await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("redirect"), "/chats?tab=media#last");
  await page.getByLabel("Email address").fill("alice@example.test");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("redirect"), "/chats?tab=media#last");
  assert.equal(await page.getByRole("button", { name: /Resend in/ }).isDisabled(), true);
  console.log("PASS protected redirect, email form and resend cooldown");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/auth/login`);
  await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  console.log("PASS mobile layout without horizontal overflow");
  signedIn = true;
  username = "user_a1b2c3d4";
  await page.goto(`${origin}/auth/post-login?at=temporary-access-token&redirect=%2Fchats`);
  await page.getByRole("heading", { name: "Pick your username" }).waitFor();
  assert.equal(page.url().includes("temporary-access-token"), false);
  availability = "taken";
  await page.getByLabel("Username", { exact: true }).fill("alice");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByText("This username is taken", { exact: true }).waitFor();
  availability = "race";
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByText("Someone just took this username. Try another.").waitFor();
  availability = "available";
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "Welcome to SilverChat, Alice!" }).waitFor();
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await page.getByRole("button", { name: "purple", exact: true }).click();
  await page.getByLabel("Language preference").selectOption("es");
  failPreferences = true;
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  await page.getByText("We couldn’t save your preferences. Try again or skip for now.").waitFor();
  failPreferences = false;
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  await page.waitForURL(/\/chats$/);
  assert.deepEqual(savedPreferences, { theme: "dark", accent: "purple", language: "es" });
  // Return to welcome to verify the independent skip path and persisted theme/accent read.
  await page.goto(`${origin}/onboarding/welcome?redirect=%2Fcalls`);
  await page.getByRole("heading", { name: "Welcome to SilverChat, Alice!" }).waitFor();
  assert.equal(await page.getByLabel("Appearance", { exact: true }).inputValue(), "dark");
  assert.equal(
    await page.getByRole("button", { name: "purple", exact: true }).getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("heading", { name: "You’re signed in, Alice." }).waitFor();
  savedPreferences = { theme: "system", accent: "blue", language: "en" };
  await page.goto(`${origin}/chats`);
  await page.getByRole("heading", { name: "Chats", exact: true }).waitFor();
  console.log("PASS callback cleanup and required/skippable onboarding");
  factor = true;
  aal = "aal1";
  rejectCode = true;
  await page.goto(`${origin}/chats`);
  await page.getByRole("heading", { name: "Two-factor authentication" }).waitFor();
  await page.getByLabel("Digit 1", { exact: true }).fill("000000");
  await page.getByRole("alert").filter({ hasText: "That code couldn’t be verified" }).waitFor();
  assert.ok(page.url().includes("/auth/2fa-verify"));
  rejectCode = false;
  await page.getByLabel("Digit 1", { exact: true }).fill("123456");
  await page.getByRole("heading", { name: "Chats", exact: true }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "Chats", exact: true }).waitFor();
  assert.equal(page.url().includes("2fa-verify"), false);
  console.log("PASS invalid TOTP retry, AAL2 login and reload");
  await page.goto(`${origin}/settings/security`);
  await page.getByText("✓ Enabled").waitFor();
  await page.getByRole("button", { name: "Disable 2FA", exact: true }).click();
  await page.getByRole("dialog", { name: "Disable two-factor authentication?" }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  console.log("PASS security state and keyboard-dismissable warning modal");
  factor = false;
  aal = "aal1";
  await page.reload();
  await page.getByRole("button", { name: "Enable 2FA", exact: true }).click();
  const enrollment = page.getByRole("dialog", { name: "Set up your authenticator" });
  await enrollment.waitFor();
  await enrollment.getByLabel("Digit 1", { exact: true }).fill("123456");
  await enrollment.getByRole("button", { name: "Verify and continue" }).click();
  const codesModal = page.getByRole("dialog", { name: "Save your backup codes" });
  await codesModal.waitFor();
  assert.equal(storedHashes.length, 10);
  assert.ok(storedHashes.every((hash) => /^[a-f0-9]{64}$/.test(hash)));
  assert.equal(
    await codesModal.getByRole("button", { name: "Done", exact: true }).isDisabled(),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(await codesModal.isVisible(), true);
  await codesModal.getByRole("checkbox").check();
  await codesModal.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByText("✓ Enabled").waitFor();
  console.log("PASS TOTP enrollment, ten hashed codes and save-before-close modal");
  aal = "aal1";
  await page.goto(`${origin}/chats`);
  await page.getByRole("button", { name: "Lost access? Use a backup code instead" }).click();
  await page.getByLabel("Backup code", { exact: true }).fill("ABCDEFGHIJ");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await page.getByText("Backup code used. Please re-enable 2FA in settings.").waitFor();
  console.log("PASS backup recovery and re-enrollment reminder");
  signedIn = false;
  // The mock token lasts an hour; AuthProvider schedules renewal at 50 minutes.
  // Advancing one minute never reaches that refresh or the 90-second presence tick.
  const expiredRefresh = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/refresh" && response.status() === 401,
  );
  await page.clock.fastForward(50 * 60_000);
  await expiredRefresh;
  await page.getByRole("dialog", { name: "Your session has expired" }).waitFor();
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  console.log("PASS session-expired modal and preserved return path");
  signedIn = true;
  for (const path of ["/calls", "/profile"]) {
    await page.goto(`${origin}${path}`);
    await page.getByRole("heading", { name: "You’re signed in, Alice." }).waitFor();
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("heading", { name: "Good conversations need their own space." }).waitFor();
  assert.equal(signedIn, false);
  console.log("PASS calls/profile placeholders and existing sign-out workflow");
  assert.deepEqual(failures, []);
  console.log("Browser checks passed; no uncaught page errors.");
} catch (error) {
  console.error("Failed at:", page.url(), await page.locator("body").textContent());
  throw error;
} finally {
  await browser.close();
}
