// Real Chromium interaction with mocked Supabase/BFF boundaries; never changes remote accounts.
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const id = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: id, aal: "aal2", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
const user = {
  id,
  email: "alice@example.test",
  aud: "authenticated",
  role: "authenticated",
  user_metadata: {},
  app_metadata: {},
  factors: [],
};
const profile = {
  id,
  username: "alice",
  display_name: "Alice Rivera",
  first_name: "Alice",
  last_name: "Rivera",
  bio: "A little more space for good conversations.",
  avatar_url: null,
  social_links: {},
  scheduled_deletion_at: null,
  username_changed_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_seen_at: null,
};
const other = {
  ...profile,
  id: otherId,
  username: "bob",
  display_name: "Bob Stone",
  first_name: null,
  last_name: null,
  avatar_url: null,
};
const settings = {
  user_id: id,
  theme: "light",
  accent: "blue",
  language: "en",
  notifications_enabled: true,
  notification_sound_enabled: true,
  notification_previews_enabled: true,
  read_receipts_enabled: true,
  presence_visible: true,
  profile_photo_visibility: "everyone",
  profile_photo_exclusions: [],
  story_visibility: "contacts",
  story_exclusions: [],
};
let fingerprint = null;
let logoutScope = null;
let changedEmail = null;
let blocked = true;
const failSettings = false;
const uploads = [];
const removed = [];
const patches = [];
let fileUrl = "";
const fulfill = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
await page.route("**/api/auth/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  const body = route.request().postDataJSON() ?? {};
  if (path.endsWith("/refresh")) {
    fingerprint = body.device_fingerprint;
    assert.match(fingerprint, /^[a-f0-9-]{36}$/i);
    if (body.action === "change_email") changedEmail = body.email;
    return fulfill(route, {
      accessToken: jwt,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      user,
      aal: "aal2",
      mfaRequired: false,
      factorId: null,
      mfaChallengeId: null,
    });
  }
  if (path.endsWith("/logout-all") || path.endsWith("/logout")) {
    logoutScope = body.scope;
    return fulfill(route, { ok: true });
  }
  throw new Error(`Unmocked auth ${path}`);
});
await page.route("https://supabase.test/**", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  const method = request.method();
  if (path.endsWith("/user")) return fulfill(route, user);
  if (path.endsWith("/profiles")) {
    if (method === "PATCH") {
      const body = request.postDataJSON();
      if (body.username && body.username !== profile.username)
        profile.username_changed_at = new Date().toISOString();
      Object.assign(profile, body);
    }
    return fulfill(route, profile);
  }
  if (path.endsWith("/user_settings")) {
    if (method === "PATCH") {
      if (failSettings) return fulfill(route, { message: "offline" }, 503);
      Object.assign(settings, request.postDataJSON());
      patches.push(request.postDataJSON());
    }
    return fulfill(route, settings);
  }
  if (path.endsWith("/profiles_visible")) {
    if (url.searchParams.has("neq") || url.searchParams.get("id")?.startsWith("neq."))
      return fulfill(route, []);
    if (url.searchParams.get("username") === "eq.bob") return fulfill(route, [other]);
    if (url.searchParams.has("username")) return fulfill(route, [profile]);
    return fulfill(route, [other]);
  }
  if (path.endsWith("/profiles_blocked"))
    return fulfill(
      route,
      blocked ? [{ id: otherId, username: "bob", display_name: "Bob Stone" }] : [],
    );
  if (path.endsWith("/user_blocks")) {
    blocked = method !== "DELETE";
    return fulfill(route, []);
  }
  if (path.endsWith("/devices"))
    return fulfill(route, [
      {
        id: "device",
        user_id: id,
        device_name: "Linux",
        device_fingerprint: fingerprint,
        last_active_at: new Date().toISOString(),
      },
    ]);
  if (path.endsWith("/chat_requests")) return fulfill(route, []);
  if (path.endsWith("/chat_members") && url.searchParams.get("select")?.includes("chat:chats"))
    return fulfill(route, []);
  if (path.endsWith("/chat_members"))
    return fulfill(
      route,
      url.searchParams.get("select")?.includes("chats")
        ? [{ chat_id: "chat", chats: { type: "direct", status: "active" } }]
        : [{ user_id: otherId }],
    );
  if (path.endsWith("/file_uploads")) {
    if (method === "POST") {
      const row = request.postDataJSON();
      uploads.push(row);
      return fulfill(route, []);
    }
    if (method === "PATCH") {
      const row = uploads.find((v) => `eq.${v.id}` === url.searchParams.get("id"));
      if (row) Object.assign(row, request.postDataJSON());
      return fulfill(route, []);
    }
    if (method === "DELETE") return fulfill(route, []);
    return fulfill(
      route,
      uploads.filter((v) => v.status === "completed"),
    );
  }
  if (path.endsWith("/app_config"))
    return fulfill(route, {
      value: { image: 10485760, video: 104857600, audio: 20971520, document: 52428800 },
    });
  if (path.endsWith("/rpc/get_my_storage_usage"))
    return fulfill(
      route,
      uploads.filter((v) => v.status === "completed").reduce((sum, v) => sum + v.size_bytes, 0),
    );
  if (path.endsWith("/rpc/schedule_account_deletion")) {
    profile.scheduled_deletion_at = new Date(Date.now() + 30 * 86400000).toISOString();
    return fulfill(route, profile.scheduled_deletion_at);
  }
  if (path.endsWith("/rpc/cancel_account_deletion")) {
    profile.scheduled_deletion_at = null;
    return fulfill(route, null);
  }
  if (path.endsWith("/rpc/create_direct_chat_request")) {
    assert.equal(request.postDataJSON().p_initial_content, "");
    return fulfill(route, "33333333-3333-4333-8333-333333333333");
  }
  if (path.includes("/storage/v1/object/sign/") && method === "POST")
    return fulfill(route, { signedURL: "/object/sign/avatars/image?token=test" });
  if (path.includes("/storage/v1/object/sign/") && method === "GET")
    return route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(fileUrl.split(",")[1], "base64"),
    });
  if (path === "/storage/v1/object/avatars" && method === "DELETE") {
    removed.push(...request.postDataJSON().prefixes);
    return fulfill(route, []);
  }
  if (path.includes("/storage/v1/object/avatars/") && method === "POST")
    return fulfill(route, { Key: path.split("/object/")[1] });
  throw new Error(`Unmocked data ${method} ${path}`);
});
const visit = async (path, title) => {
  await page.goto(`http://127.0.0.1:5173${path}`);
  await page.getByRole("heading", { name: title, exact: true }).first().waitFor();
};
try {
  await visit("/settings", "Settings");
  await page.getByRole("heading", { name: "Alice Rivera" }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: "/tmp/silverchat-settings-desktop.png", fullPage: true });
  console.log("PASS settings index, identity and desktop layout");
  await visit("/settings/profile", "Edit profile");
  await page.getByLabel("Display name", { exact: true }).fill("Alice Updated");
  await page.getByLabel("Bio", { exact: true }).fill("Updated bio");
  await page.getByLabel("Username", { exact: true }).fill("alice_new");
  await page.getByRole("button", { name: "Save profile" }).click();
  await page.getByText("Profile updated", { exact: true }).waitFor();
  assert.equal(profile.display_name, "Alice Updated");
  assert.equal(await page.getByLabel("Username", { exact: true }).getAttribute("readonly"), "");
  await page.reload();
  await page.getByLabel("Display name", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Display name", { exact: true }).inputValue(),
    "Alice Updated",
  );
  console.log("PASS profile saves, reload persistence and username cooldown UI");
  fileUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#5089cc";
    ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = "#ffe08c";
    ctx.beginPath();
    ctx.arc(400, 300, 160, 0, Math.PI * 2);
    ctx.fill();
    return canvas.toDataURL("image/png");
  });
  await page.getByRole("button", { name: "Change photo", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "portrait.png",
      mimeType: "image/png",
      buffer: Buffer.from(fileUrl.split(",")[1], "base64"),
    });
  await dialog.getByLabel(/Zoom/).waitFor();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Profile photo updated", { exact: true }).waitFor();
  assert.match(profile.avatar_url, new RegExp(`^${id}/avatar-.*\\.webp$`));
  assert.equal(uploads[0].mime_type, "image/webp");
  assert.ok(uploads[0].size_bytes < 100000);
  assert.equal(uploads[0].status, "completed");
  await page.getByRole("button", { name: "Change photo", exact: true }).click();
  await page.getByRole("button", { name: "Remove photo", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(profile.avatar_url, null);
  assert.equal(removed.length, 1);
  console.log("PASS real image crop, WebP compression, tracked upload and removal");
  await visit("/settings/profile/social", "Social links");
  await page.getByLabel("Twitter / X").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Add custom link" }).click();
  await page.getByLabel("Label", { exact: true }).fill("Portfolio");
  await page.getByLabel("URL or text", { exact: true }).fill("https://example.test/");
  await page.getByRole("button", { name: "Save links" }).click();
  await page.getByText("Saved", { exact: true }).waitFor();
  await visit("/profile/alice_new", "Alice Updated");
  assert.equal(await page.locator('a[href^="javascript:"]').count(), 0);
  assert.equal(
    await page.getByRole("link", { name: "Portfolio" }).getAttribute("rel"),
    "noopener noreferrer",
  );
  console.log("PASS social normalization and inert unsafe schemes on public profile");
  await visit("/settings/appearance", "Appearance");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.getByRole("button", { name: "purple", exact: true }).click();
  await page.getByLabel("Language", { exact: true }).selectOption("es");
  await page.getByRole("heading", { name: "Apariencia" }).waitFor();
  await page.waitForFunction(() => localStorage.getItem("silverchat_language") === "es");
  await page.waitForResponse(
    (r) => r.url().includes("/user_settings") && r.request().method() === "PATCH",
  );
  assert.equal(settings.theme, "dark");
  assert.equal(settings.accent, "purple");
  assert.equal(settings.language, "es");
  await page.reload();
  await page.getByRole("heading", { name: "Apariencia" }).waitFor();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  assert.match(await page.locator("html").getAttribute("class"), /theme-purple/);
  await page.screenshot({ path: "/tmp/silverchat-settings-dark.png", fullPage: true });
  await page.getByLabel("Idioma").selectOption("en");
  await page.getByRole("heading", { name: "Appearance" }).waitFor();
  await page.waitForResponse(
    (r) => r.url().includes("/user_settings") && r.request().method() === "PATCH",
  );
  console.log("PASS instant theme/accent/language, debounced persistence and reload hydration");
  await visit("/settings/privacy", "Privacy");
  await page.getByRole("switch", { name: /Send read receipts/ }).click();
  await page.getByRole("dialog", { name: "Turn off read receipts?" }).waitFor();
  assert.equal(settings.read_receipts_enabled, true);
  await page.getByRole("button", { name: "Keep enabled" }).click();
  assert.equal(settings.read_receipts_enabled, true);
  await page.getByRole("switch", { name: /Send read receipts/ }).click();
  await page.getByRole("button", { name: "Turn off", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(settings.read_receipts_enabled, false);
  await visit("/settings/privacy/visibility#photo", "Privacy");
  await page
    .locator("#photo")
    .getByRole("radio", { name: "My contacts except…", exact: true })
    .check();
  await page
    .locator("#photo")
    .getByRole("button", { name: /Manage exclusions/ })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel(/Bob Stone/)
    .check();
  await page.getByRole("button", { name: "Save (1)" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.deepEqual(settings.profile_photo_exclusions, [otherId]);
  await visit("/settings/privacy/blocked", "Blocked contacts");
  await page.getByRole("button", { name: "Unblock" }).click();
  await page.getByText("You haven’t blocked anyone.").waitFor();
  assert.equal(blocked, false);
  console.log("PASS read-receipt warning, exclusions and optimistic unblock");
  await visit("/settings/devices", "Devices");
  await page.getByText("This device", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Sign out all other devices" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByText("Other devices signed out").waitFor();
  assert.equal(logoutScope, "others");
  await page.reload();
  await page.getByText("This device", { exact: true }).waitFor();
  console.log("PASS device identity and other-device sign-out preserves this session");
  await visit("/settings/account", "Account");
  await page.getByRole("button", { name: "Change email", exact: true }).click();
  await page.getByLabel("New email", { exact: true }).fill("new@example.test");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByText(/Confirmation sent to new@example.test/).waitFor();
  assert.equal(changedEmail, "new@example.test");
  await page.getByRole("dialog").getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Delete account", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Schedule deletion" }).isDisabled(), true);
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Schedule deletion" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.locator(".deletion-banner").waitFor();
  await visit("/chats", /^Chats$/);
  await page.locator(".deletion-banner").getByRole("button", { name: "Cancel deletion" }).click();
  await page.locator(".deletion-banner").waitFor({ state: "hidden" });
  assert.equal(profile.scheduled_deletion_at, null);
  console.log("PASS BFF email change, deletion confirmation and global cancellation");
  await visit("/settings/notifications", "Notifications");
  const toggle = async (name) => {
    const response = page.waitForResponse(
      (r) => r.url().includes("/user_settings") && r.request().method() === "PATCH",
    );
    await page.getByRole("switch", { name, exact: true }).click();
    await response;
  };
  await toggle("Notifications");
  assert.equal(await page.getByRole("switch", { name: "Sound", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Preview notification" }).isDisabled(), true);
  await toggle("Notifications");
  await toggle("Message previews");
  await toggle("Sound");
  await page.getByRole("button", { name: "Preview notification" }).click();
  await page.getByText("New message", { exact: true }).waitFor();
  console.log("PASS notification master switch and preview privacy");
  await page.setViewportSize({ width: 390, height: 844 });
  await visit("/settings", "Settings");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: "/tmp/silverchat-settings-mobile.png", fullPage: true });
  await visit("/settings/storage", "Storage");
  await page.getByText(/MB used/).waitFor();
  await visit("/settings/about", "About");
  await page.getByText("Version 0.0.1").waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS mobile layout, storage/about and no browser runtime errors");
} finally {
  await browser.close();
}
