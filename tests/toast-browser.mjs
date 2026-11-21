// Real browser verification of SilverChat's toast notification system:
// (a) Centered horizontally in the chat/main viewport & anchored above the composer
// (b) Automatically dismisses after 2 seconds (including re-trigger / stacking)
// (c) Dark glassmorphic styling, cyan/blue accent glow, icon, motion, and accessibility
import assert from "node:assert/strict";
import { launchBrowser } from "./lib/browser.mjs";

const baseUrl = process.env.UI_BASE_URL ?? process.env.TEST_BASE_URL ?? "http://127.0.0.1:5173";
const uid = (n) => `${String(n).padStart(8, "0")}-2222-4222-8222-222222222222`;
const me = uid(1);
const other = uid(2);
const dave = uid(4);
const groupId = uid(101);

const user = {
  id: me,
  email: "alice@example.test",
  aud: "authenticated",
  role: "authenticated",
  user_metadata: {},
  app_metadata: {},
  factors: [],
};

const profiles = [
  {
    id: me,
    username: "alice",
    display_name: "Alice Rivera",
    avatar_url: null,
    scheduled_deletion_at: null,
  },
  {
    id: other,
    username: "sofia",
    display_name: "Sofia Reyes",
    avatar_url: null,
    last_seen_at: new Date().toISOString(),
  },
  {
    id: dave,
    username: "dave",
    display_name: "Dave Park",
    avatar_url: null,
    last_seen_at: null,
  },
];

const groupMembers = [
  { user_id: me, role: "admin", joined_at: "2020-01-01" },
  { user_id: other, role: "member", joined_at: "2020-01-02" },
];

const groupChat = {
  id: groupId,
  type: "group",
  name: "Weekend people",
  created_by: me,
  created_at: "2020-01-01T00:00:00Z",
  description: "Weekend plans",
  direct_pair_key: null,
  status: "active",
  avatar_url: null,
  only_admins_can_send: false,
  community_id: null,
};

const groupRows = [
  {
    id: uid(300),
    chat_id: groupId,
    sender_id: other,
    type: "text",
    content: "Welcome to the weekend group",
    created_at: new Date(Date.now() - 10 * 60000).toISOString(),
    deleted_for_everyone: false,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    mentions: null,
  },
];

const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(
  JSON.stringify({ sub: me, aal: "aal2", exp: Math.floor(Date.now() / 1000) + 3600 }),
).toString("base64url")}.signature`;

const response = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function setupRoutes(context) {
  await context.route("https://cdn.jsdelivr.net/npm/emojibase-data@*/**", (route) => route.abort());
  await context.route("**/api/auth/**", (r) =>
    response(r, {
      accessToken: jwt,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      user,
      aal: "aal2",
      mfaRequired: false,
    }),
  );
  await context.route("https://supabase.test/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const s = url.searchParams;
    const p = url.pathname;
    const method = req.method();
    const object = req.headers().accept?.includes("object");
    const result = (data) => response(route, object ? (data[0] ?? null) : data);

    if (p.endsWith("/user")) return response(route, user);
    if (p.endsWith("/profiles")) return response(route, profiles[0]);
    if (p.endsWith("/profiles_visible")) {
      return response(
        route,
        profiles.filter((pr) => pr.id !== me),
      );
    }
    if (p.endsWith("/user_settings")) {
      return response(route, {
        user_id: me,
        theme: "dark",
        accent: "blue",
        language: "en",
        read_receipts_enabled: true,
        typing_indicators_enabled: true,
        notifications_enabled: true,
        notification_sound_enabled: true,
        notification_previews_enabled: true,
        last_seen_visibility: "everyone",
        profile_photo_visibility: "everyone",
        about_visibility: "everyone",
      });
    }
    if (p.endsWith("/rpc/get_blocked_user_ids")) return response(route, []);
    if (p.endsWith("/rpc/get_my_chats")) {
      return response(route, [
        {
          chat_id: groupId,
          chat_type: "group",
          chat_name: groupChat.name,
          chat_avatar_url: null,
          chat_status: "active",
          other_user_id: null,
          other_username: null,
          other_display_name: null,
          other_avatar_url: null,
          other_last_seen_at: null,
          last_message_id: groupRows[0].id,
          last_message_content: groupRows[0].content,
          last_message_type: "text",
          last_message_sender_id: other,
          last_message_at: groupRows[0].created_at,
          last_message_deleted: false,
          unread_count: 0,
          archived_at: null,
          favorited_at: null,
          pinned_at: null,
          muted_until: null,
          manually_unread: false,
          community_id: null,
        },
      ]);
    }
    if (p.endsWith("/rpc/get_my_unread_reactions")) return response(route, []);
    if (p.endsWith("/rpc/get_chat_details")) {
      return response(route, {
        ...groupChat,
        members: groupMembers.map((m) => ({
          ...m,
          profile: profiles.find((pr) => pr.id === m.user_id) ?? null,
        })),
        own: {
          chat_id: groupId,
          user_id: me,
          role: "admin",
          muted_until: null,
          pinned_at: null,
          joined_at: "2020-01-01T00:00:00Z",
          manually_unread: false,
        },
      });
    }
    if (p.endsWith("/rpc/list_direct_contacts")) {
      return response(
        route,
        profiles
          .filter((pr) => pr.id !== me)
          .map((pr) => ({
            user_id: pr.id,
            username: pr.username,
            display_name: pr.display_name,
            avatar_url: pr.avatar_url,
          })),
      );
    }
    if (p.endsWith("/rpc/search_users")) {
      return response(
        route,
        profiles.filter((pr) => pr.id !== me),
      );
    }
    if (p.endsWith("/rpc/add_chat_members")) {
      const body = req.postDataJSON();
      let added = 0;
      for (const id of body.p_user_ids ?? []) {
        if (!groupMembers.some((m) => m.user_id === id)) {
          groupMembers.push({ user_id: id, role: "member", joined_at: new Date().toISOString() });
          added++;
        }
      }
      return response(route, added);
    }
    if (p.endsWith("/rpc/clear_chat_for_me")) return response(route, groupRows.length);
    if (p.endsWith("/rpc/get_chat_messages")) return response(route, groupRows);
    if (p.endsWith("/rpc/mark_chat_messages_read")) return response(route, 0);
    if (p.endsWith("/chats")) return result([groupChat]);
    if (p.endsWith("/chat_members")) return result(groupMembers);
    if (p.endsWith("/messages")) {
      const limit = Number(s.get("limit") ?? "100");
      return response(route, groupRows.slice(-limit).reverse());
    }
    if (p.endsWith("/message_receipts")) return response(route, []);
    if (p.endsWith("/message_reactions")) return response(route, []);
    if (p.endsWith("/pinned_messages")) return response(route, []);
    if (p.endsWith("/message_reports")) return response(route, []);
    if (p.endsWith("/user_blocks")) return response(route, []);
    if (method === "HEAD")
      return route.fulfill({ status: 200, headers: { "content-range": "0-0/0" } });
    return response(route, []);
  });
}

async function assertCenteredInChatPane(page, label) {
  const toast = page.locator('[data-slot="toast"]').first();
  await toast.waitFor({ state: "visible" });
  const metrics = await page.evaluate(() => {
    const pane = document.querySelector(".chat-content-pane");
    const composer = document.querySelector('[data-slot="composer-dock"]');
    const toastEl = document.querySelector('[data-slot="toast"]');
    if (!pane || !toastEl) return null;
    const paneRect = pane.getBoundingClientRect();
    const toastRect = toastEl.getBoundingClientRect();
    const composerRect = composer ? composer.getBoundingClientRect() : null;
    const style = getComputedStyle(toastEl);
    return {
      paneLeft: paneRect.left,
      paneRight: paneRect.right,
      paneCenterX: paneRect.left + paneRect.width / 2,
      toastLeft: toastRect.left,
      toastRight: toastRect.right,
      toastBottom: toastRect.bottom,
      toastCenterX: toastRect.left + toastRect.width / 2,
      composerTop: composerRect ? composerRect.top : null,
      backdropFilter: style.backdropFilter,
      boxShadow: style.boxShadow,
      borderColor: style.borderColor,
      role: toastEl.getAttribute("role"),
      ariaLive: toastEl.getAttribute("aria-live"),
      tone: toastEl.getAttribute("data-tone"),
      hasIcon: Boolean(toastEl.querySelector(".silver-toast-icon svg")),
      inTopLayer: toastEl.closest("[popover]")?.matches(":popover-open") ?? false,
    };
  });
  assert.ok(metrics, `${label}: expected pane and toast metrics`);
  const centerDelta = Math.abs(metrics.toastCenterX - metrics.paneCenterX);
  assert.ok(
    centerDelta <= 2,
    `${label}: expected horizontal centering within 2px, got delta=${centerDelta.toFixed(2)} (toastCenter=${metrics.toastCenterX}, paneCenter=${metrics.paneCenterX})`,
  );
  assert.ok(
    metrics.toastLeft >= metrics.paneLeft && metrics.toastRight <= metrics.paneRight,
    `${label}: toast must stay inside chat-content-pane bounds`,
  );
  if (metrics.composerTop !== null) {
    assert.ok(
      metrics.toastBottom < metrics.composerTop,
      `${label}: toast bottom (${metrics.toastBottom}) must sit above composer top (${metrics.composerTop})`,
    );
  }
  assert.ok(
    metrics.backdropFilter.includes("blur"),
    `${label}: expected glassmorphic backdrop-filter blur, got ${metrics.backdropFilter}`,
  );
  assert.notEqual(metrics.boxShadow, "none", `${label}: expected neon accent glow box-shadow`);
  assert.equal(metrics.hasIcon, true, `${label}: expected status icon`);
  assert.equal(metrics.role, "status", `${label}: expected role="status"`);
  assert.equal(metrics.ariaLive, "polite", `${label}: expected aria-live="polite"`);
  assert.equal(metrics.inTopLayer, true, `${label}: expected top-layer popover`);
}

const browser = await launchBrowser({ args: ["--no-sandbox"] });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupRoutes(context);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto(`${baseUrl}/chats/${groupId}`);
  await page.locator(".message-list").waitFor();

  // Trigger real "Added 1 members" toast flow on wide desktop (chat list + chat pane + details pane)
  await page.getByRole("button", { name: "Chat options", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add members", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add members", exact: true });
  await dialog.waitFor();
  await dialog.getByRole("searchbox").fill("dave");
  await dialog.getByRole("checkbox", { name: /Dave Park/ }).check();
  await dialog.getByRole("button", { name: "Add 1 members", exact: true }).click();

  const toast = page.locator('[data-slot="toast"]');
  await toast.filter({ hasText: "Added 1 members" }).waitFor({ state: "visible" });
  await assertCenteredInChatPane(page, "Desktop wide (1280x900) Added 1 members");

  // (b) Verify 2-second auto-dismiss
  await page.waitForTimeout(1200);
  assert.equal(await toast.count(), 1, "Toast must still be visible before 2s");
  await toast.waitFor({ state: "detached", timeout: 2000 });
  assert.equal(await toast.count(), 0, "Toast must auto-close after 2s");

  // Verify centering on 1024x800 (no details pane) by re-triggering via clearing chat / opening chat options
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.getByRole("button", { name: "Chat options", exact: true }).click();
  await page.getByRole("menuitem", { name: "Clear chat", exact: true }).click();
  const clearDialog = page.getByRole("dialog", { name: "Clear this chat?", exact: true });
  await clearDialog.waitFor();
  await clearDialog.getByRole("button", { name: "Clear chat", exact: true }).click();
  await toast.filter({ hasText: "Chat cleared" }).waitFor({ state: "visible" });
  await assertCenteredInChatPane(page, "Desktop (1024x800) Chat cleared");
  await toast.waitFor({ state: "detached", timeout: 3000 });

  // Verify centering on mobile (390x844) above composer
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await setupRoutes(mobile);
  const mp = await mobile.newPage();
  mp.on("pageerror", (err) => errors.push(err.message));
  await mp.goto(`${baseUrl}/chats/${groupId}`);
  await mp.locator(".message-list").waitFor();
  await mp.getByRole("button", { name: "Chat options", exact: true }).click();
  await mp.getByRole("menuitem", { name: "Clear chat", exact: true }).click();
  const mobileClearDialog = mp.getByRole("dialog", { name: "Clear this chat?", exact: true });
  await mobileClearDialog.waitFor();
  await mobileClearDialog.getByRole("button", { name: "Clear chat", exact: true }).click();
  const mobileToast = mp.locator('[data-slot="toast"]');
  await mobileToast.filter({ hasText: "Chat cleared" }).waitFor({ state: "visible" });
  await assertCenteredInChatPane(mp, "Mobile (390x844) Chat cleared");
  await mobileToast.waitFor({ state: "detached", timeout: 3000 });
  await mobile.close();

  assert.deepEqual(errors, []);
  console.log("PASS: toast centering, 2s auto-dismiss, and SilverChat glass/glow theme verified.");
} finally {
  await browser.close();
}
