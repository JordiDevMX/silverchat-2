import assert from "node:assert/strict";
import { launchBrowser } from "./lib/browser.mjs";

const origin = process.env.UI_BASE_URL ?? "http://127.0.0.1:5175";
const browser = await launchBrowser({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(10000);

const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

const userId = "11111111-1111-4111-8111-111111111111";
const factorId = "22222222-2222-4222-8222-222222222222";
let requiresReenrollment = true;
let hasFactor = false;
let releaseProbe = null;
let devices = [
  {
    id: "dev-historical",
    device_name: "Old Linux",
    device_fingerprint: "88888888-8888-4888-8888-888888888888",
    created_at: "2026-11-10T00:00:00.000Z",
  },
];

const jwt = () =>
  `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(
    JSON.stringify({ sub: userId, aal: "aal1", exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url")}.signature`;

const userPayload = () => ({
  id: userId,
  email: "alice@example.test",
  aud: "authenticated",
  role: "authenticated",
  user_metadata: { requires_reenrollment: requiresReenrollment },
  app_metadata: {},
  factors: hasFactor
    ? [{ id: factorId, factor_type: "totp", status: "verified", friendly_name: "Authenticator" }]
    : [],
});

const fulfill = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

await page.route("**/api/auth/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path.endsWith("/refresh")) {
    return fulfill(route, {
      accessToken: jwt(),
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      user: { id: userId, email: "alice@example.test" },
      aal: "aal1",
      mfaRequired: false,
      mfaChallengeId: null,
      factorId: hasFactor ? factorId : null,
    });
  }
  return fulfill(route, { ok: true });
});

await page.route("https://supabase.test/**", async (route) => {
  const url = new URL(route.request().url());
  if (route.request().method() === "HEAD") {
    await new Promise((resolve) => {
      releaseProbe = resolve;
    });
    return route.fulfill({ status: 200, headers: { "content-range": "0-0/1" }, body: "" });
  }
  if (url.pathname.endsWith("/user")) return fulfill(route, userPayload());
  if (url.pathname.endsWith("/profiles")) {
    return fulfill(route, {
      id: userId,
      username: "alice",
      display_name: "Alice",
      avatar_url: null,
      first_name: null,
      last_name: null,
      bio: null,
      social_links: {},
      last_seen_at: null,
      created_at: "2026-11-01T00:00:00.000Z",
      updated_at: "2026-11-01T00:00:00.000Z",
    });
  }
  if (url.pathname.endsWith("/user_settings")) {
    return fulfill(route, { theme: "system", accent: "blue", language: "en" });
  }
  if (url.pathname.endsWith("/devices")) {
    return fulfill(route, devices);
  }
  return fulfill(route, []);
});

try {
  await page.goto(`${origin}/chats`);
  await page.getByText("Backup code used. Please re-enable 2FA in settings.").waitFor();
  assert.equal(
    await page.getByText("New sign-in detected on Old Linux.").count(),
    0,
    "pre-existing historical devices must not trigger a false-positive banner",
  );
  assert.equal(
    await page
      .getByRole("link", { name: "Open security settings", exact: true })
      .getAttribute("href"),
    "/settings/security",
  );

  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.getByText("Backup code used. Please re-enable 2FA in settings.").waitFor({
    state: "detached",
  });

  await page.reload();
  await page.locator("section[aria-label='Chats']").waitFor();
  assert.equal(
    await page.getByText("Backup code used. Please re-enable 2FA in settings.").count(),
    0,
    "dismissed 2FA re-enrollment banner stays hidden after reload",
  );

  requiresReenrollment = false;
  hasFactor = true;
  await page.reload();
  await page.locator("section[aria-label='Chats']").waitFor();

  requiresReenrollment = true;
  hasFactor = false;
  await page.reload();
  await page.getByText("Backup code used. Please re-enable 2FA in settings.").waitFor();
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.getByText("Backup code used. Please re-enable 2FA in settings.").waitFor({
    state: "detached",
  });

  devices = [
    {
      id: "dev-new",
      device_name: "Mac",
      device_fingerprint: "99999999-9999-4999-8999-999999999999",
      created_at: new Date(Date.now() + 60_000).toISOString(),
    },
    ...devices,
  ];
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByText("New sign-in detected on Mac.").waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Review devices", exact: true }).getAttribute("href"),
    "/settings/devices",
  );

  await page.evaluate(async () => {
    const { useSupabaseHealth } = await import("/src/lib/supabase-health.ts");
    useSupabaseHealth.getState().markDown();
  });
  await page.getByRole("alert").filter({ hasText: "Connection issues" }).waitFor();
  assert.equal(
    await page.getByText("New sign-in detected on Mac.").count(),
    0,
    "security banner yields while connection outage banner is visible",
  );
  releaseProbe?.();
  await page.getByText("New sign-in detected on Mac.").waitFor();

  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.getByText("New sign-in detected on Mac.").waitFor({ state: "detached" });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  assert.equal(
    await page.getByText("New sign-in detected on Mac.").count(),
    0,
    "dismissed new-device banner stays hidden on subsequent checks",
  );

  assert.deepEqual(errors, []);
  console.log(
    "PASS TopBanner: 2FA re-enrollment dismissal/re-arm, new-device detection/dismissal, and outage priority",
  );
} finally {
  await browser.close();
}
