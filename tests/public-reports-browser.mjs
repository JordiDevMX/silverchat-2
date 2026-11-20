// Real browser verification for public-only reporting, redesigned ReportModal, and integrated blocking.
import assert from "node:assert/strict";
import { launchBrowser } from "./lib/browser.mjs";

const baseUrl = process.env.UI_BASE_URL ?? process.env.TEST_BASE_URL ?? "http://127.0.0.1:5173";
const uid = (n) => `${String(n).padStart(8, "0")}-4444-4444-8444-444444444444`;
const me = uid(1);
const bobId = uid(2);
const sofiaId = uid(3);
const directChatId = uid(100);
const followedChannelId = uid(201);
const ownedChannelId = uid(202);
const orphanChannelId = uid(203);

const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(
  JSON.stringify({ sub: me, aal: "aal2", exp: Math.floor(Date.now() / 1000) + 3600 }),
).toString("base64url")}.signature`;

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
  { id: bobId, username: "bob", display_name: "Bob Stone", avatar_url: null, bio: "Public bio" },
  { id: sofiaId, username: "sofia", display_name: "Sofia Reyes", avatar_url: null },
];

const channels = [
  {
    id: followedChannelId,
    owner_id: sofiaId,
    name: "Tech Dispatch",
    slug: "tech-dispatch",
    description: "Daily engineering notes",
    follower_count: 120,
    is_verified: true,
    avatar_url: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    last_message_at: "2026-01-01T00:00:00Z",
    last_message_preview: "Hello subscribers",
  },
  {
    id: ownedChannelId,
    owner_id: me,
    name: "My Announcements",
    slug: "my-announcements",
    description: "Owned channel",
    follower_count: 10,
    is_verified: false,
    avatar_url: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    last_message_at: null,
    last_message_preview: null,
  },
  {
    id: orphanChannelId,
    owner_id: null,
    name: "Archive Feed",
    slug: "archive-feed",
    description: "Ownerless channel",
    follower_count: 42,
    is_verified: false,
    avatar_url: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    last_message_at: null,
    last_message_preview: null,
  },
];

const reports = [];
const blocks = [];
const errors = [];
let failNextBlock = false;
let currentTheme = "light";

const respond = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function setupRoutes(context) {
  await context.route("https://cdn.jsdelivr.net/npm/emojibase-data@*/**", (r) => r.abort());
  await context.route("**/api/auth/**", (r) =>
    respond(r, {
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
    const p = url.pathname;
    const s = url.searchParams;
    const method = req.method();
    const acceptObj = req.headers().accept?.includes("object");
    const body =
      ["POST", "PATCH", "DELETE"].includes(method) &&
      req.postData() &&
      req.headers()["content-type"]?.includes("application/json")
        ? req.postDataJSON()
        : {};
    const out = (rows) => respond(route, acceptObj ? (rows[0] ?? null) : rows);

    if (p.endsWith("/user")) return respond(route, user);
    if (p.endsWith("/profiles")) return respond(route, profiles[0]);
    if (p.endsWith("/user_settings")) {
      return respond(route, {
        user_id: me,
        theme: currentTheme,
        accent: "blue",
        language: "en",
        read_receipts_enabled: true,
      });
    }
    if (p.endsWith("/profiles_visible")) {
      const uname = s.get("username")?.slice(3);
      if (uname) return out(profiles.filter((x) => x.username === uname));
      const idFilter = s.get("id");
      if (idFilter?.startsWith("eq."))
        return out(profiles.filter((x) => x.id === idFilter.slice(3)));
      return out(profiles);
    }
    if (p.endsWith("/app_config")) return out([{ key: "avatar_gradient_palette", value: [] }]);
    if (p.endsWith("/reports")) {
      reports.push(body);
      return respond(route, null, 201);
    }
    if (p.endsWith("/user_blocks")) {
      if (method === "POST") {
        if (failNextBlock) {
          failNextBlock = false;
          return respond(route, { message: "block error" }, 503);
        }
        blocks.push(body);
      }
      return out([]);
    }
    if (p.endsWith("/channels")) {
      const id = s.get("id")?.slice(3);
      return out(id ? channels.filter((c) => c.id === id) : channels);
    }
    if (p.endsWith("/channel_followers")) {
      const cid = s.get("channel_id")?.slice(3);
      if (cid === followedChannelId) {
        return out([
          {
            channel_id: followedChannelId,
            user_id: me,
            followed_at: "2026-01-01T00:00:00Z",
            last_read_at: "2026-01-01T00:00:00Z",
            muted_until: null,
          },
        ]);
      }
      return out([]);
    }
    if (p.endsWith("/chats")) {
      return out([
        {
          id: directChatId,
          type: "direct",
          name: null,
          created_by: me,
          created_at: "2026-01-01T00:00:00Z",
          description: null,
          direct_pair_key: [me, bobId].sort().join("::"),
          status: "active",
          avatar_url: null,
          community_id: null,
        },
      ]);
    }
    if (p.endsWith("/chat_members")) {
      if (s.get("select")?.includes("chat:chats")) return out([]);
      return out([
        {
          chat_id: directChatId,
          user_id: me,
          role: "member",
          muted_until: null,
          pinned_at: null,
          joined_at: "2026-01-01T00:00:00Z",
          manually_unread: false,
        },
        {
          chat_id: directChatId,
          user_id: bobId,
          role: "member",
          muted_until: null,
          pinned_at: null,
          joined_at: "2026-01-01T00:00:00Z",
          manually_unread: false,
        },
      ]);
    }
    if (p.endsWith("/chat_requests")) return out([]);
    if (p.endsWith("/messages")) return out([]);
    if (
      p.endsWith("/message_receipts") ||
      p.endsWith("/message_reactions") ||
      p.endsWith("/message_deletions")
    )
      return out([]);
    if (p.includes("/rpc/get_chat_messages")) return respond(route, []);
    return out([]);
  });
}

async function assertRadioGeometry(dialog) {
  const boxes = await dialog.locator('input[type="radio"]').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height, x: r.x, y: r.y };
    }),
  );
  assert.equal(boxes.length, 4, "Expected 4 report reason radios");
  for (const box of boxes) {
    assert.ok(box.width >= 14 && box.width <= 24, `Unexpected radio width: ${box.width}`);
    assert.ok(box.height >= 14 && box.height <= 24, `Unexpected radio height: ${box.height}`);
    assert.ok(
      Math.abs(box.width - box.height) <= 1,
      `Non-circular radio: ${box.width}x${box.height}`,
    );
    assert.ok(Math.abs(box.x - boxes[0].x) <= 1, `Misaligned radio x: ${box.x} vs ${boxes[0].x}`);
  }
  for (let i = 1; i < boxes.length; i++) {
    assert.ok(boxes[i].y > boxes[i - 1].y, "Radios should stack cleanly top-to-bottom");
  }
  const [closeBox, targetBox] = await Promise.all([
    dialog.locator(".report-close").boundingBox(),
    dialog.locator(".report-target-card").boundingBox(),
  ]);
  assert.ok(closeBox && targetBox, "Close button and target card must render");
  assert.ok(
    closeBox.y + closeBox.height <= targetBox.y,
    `Close button (${closeBox.y}+${closeBox.height}) must stay in header above target card (${targetBox.y})`,
  );
}

const browser = await launchBrowser({ args: ["--no-sandbox"] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupRoutes(ctx);
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. Private direct chat must NOT show Report anywhere, while keeping Block.
  await page.goto(`${baseUrl}/chats/${directChatId}`);
  await page.locator(".conversation-header").waitFor();
  await page.getByRole("button", { name: "Chat options", exact: true }).click();
  assert.equal(await page.getByRole("menuitem", { name: /Report/ }).count(), 0);
  assert.equal(await page.getByRole("menuitem", { name: "Block", exact: true }).count(), 1);
  await page.keyboard.press("Escape");

  await page.locator("button.conversation-identity").click();
  const contactDialog = page.getByRole("dialog", { name: "Contact profile", exact: true });
  await contactDialog.waitFor();
  assert.equal(await contactDialog.getByRole("button", { name: "Block", exact: true }).count(), 1);
  assert.equal(await contactDialog.getByRole("button", { name: /Report/ }).count(), 0);
  await contactDialog.getByRole("button", { name: "Close", exact: true }).click();
  console.log("PASS 1: private direct chat exposes Block and zero Report entry points");

  // 2. Public channel header menu + ChannelInfoScreen report + anonymous creator block.
  await page.goto(`${baseUrl}/channels/${followedChannelId}`);
  await page.locator(".channel-header").waitFor();
  await page.getByRole("button", { name: "Channel options", exact: true }).click();
  await page.getByRole("menuitem", { name: "Report channel", exact: true }).click();
  const chModal = page.getByRole("dialog", { name: "Report channel", exact: true });
  await chModal.waitFor();
  assert.ok(
    !/sofia/i.test((await chModal.textContent()) ?? ""),
    "Creator identity must never appear",
  );
  await assertRadioGeometry(chModal);
  if (process.env.REPORT_SCREENSHOT_LIGHT) {
    await page.screenshot({ path: process.env.REPORT_SCREENSHOT_LIGHT });
  }
  await chModal.getByRole("button", { name: "Cancel", exact: true }).click();
  await chModal.waitFor({ state: "detached" });

  await page.goto(`${baseUrl}/channels/${followedChannelId}/info`);
  await page.locator(".channel-profile").waitFor();
  await page.getByRole("button", { name: "Report channel", exact: true }).click();
  const infoModal = page.getByRole("dialog", { name: "Report channel", exact: true });
  await infoModal.waitFor();
  await assertRadioGeometry(infoModal);
  await infoModal.getByRole("radio", { name: "Other", exact: true }).check();
  assert.equal(
    await infoModal.getByRole("button", { name: "Submit report", exact: true }).isDisabled(),
    true,
  );
  await infoModal.getByRole("textbox", { name: "Details" }).fill("Repeated scam links");
  await infoModal.getByRole("switch").click();
  await infoModal.getByRole("button", { name: "Report and block", exact: true }).click();
  await infoModal.waitFor({ state: "detached" });
  assert.deepEqual(reports.at(-1), {
    reporter_id: me,
    reported_channel_id: followedChannelId,
    reported_user_id: null,
    reason: "other",
    description: "Repeated scam links",
  });
  assert.deepEqual(blocks.at(-1), { blocker_id: me, blocked_id: sofiaId });
  await page
    .locator(".chat-settings-notice")
    .filter({ hasText: "Report submitted and user blocked." })
    .waitFor();
  console.log("PASS 2: channel report + anonymous creator block + aligned radios");

  // 3. Ownerless channel omits block-creator switch without breaking submission.
  await page.goto(`${baseUrl}/channels/${orphanChannelId}/info`);
  await page.locator(".channel-profile").waitFor();
  await page.getByRole("button", { name: "Report channel", exact: true }).click();
  const orphanModal = page.getByRole("dialog", { name: "Report channel", exact: true });
  await orphanModal.waitFor();
  assert.equal(await orphanModal.getByRole("switch").count(), 0);
  await orphanModal.getByRole("button", { name: "Submit report", exact: true }).click();
  await orphanModal.waitFor({ state: "detached" });
  assert.equal(reports.at(-1).reported_channel_id, orphanChannelId);
  console.log("PASS 3: ownerless channel hides block switch and submits cleanly");

  // 4. Channel owner never sees Report channel.
  await page.goto(`${baseUrl}/channels/${ownedChannelId}/info`);
  await page.locator(".channel-profile").waitFor();
  assert.equal(await page.getByRole("button", { name: "Report channel", exact: true }).count(), 0);
  console.log("PASS 4: channel owner does not see Report channel");

  // 5. Public profile (/profile/bob) report + partial-block failure handling.
  await page.goto(`${baseUrl}/profile/bob`);
  await page.getByRole("heading", { name: "Bob Stone", exact: true }).waitFor();
  await page.getByRole("button", { name: "Report", exact: true }).click();
  const profileModal = page.getByRole("dialog", { name: "Report user", exact: true });
  await profileModal.waitFor();
  await assertRadioGeometry(profileModal);
  failNextBlock = true;
  await profileModal.getByRole("radio", { name: "Harassment", exact: true }).check();
  await profileModal.getByRole("switch").click();
  await profileModal.getByRole("button", { name: "Report and block", exact: true }).click();
  await profileModal.waitFor({ state: "detached" });
  assert.equal(reports.at(-1).reported_user_id, bobId);
  assert.equal(reports.at(-1).reported_channel_id, null);
  await page
    .locator(".chat-settings-notice")
    .filter({ hasText: /Report submitted, but blocking failed/ })
    .waitFor();
  console.log("PASS 5: public profile report + partial block failure notice");

  // 6. Dark mode + mobile viewport overflow & alignment check across PublicProfilePage, ChannelInfoScreen, and ReportModal.
  currentTheme = "dark";
  for (const [width, height] of [
    [375, 844],
    [390, 844],
  ]) {
    const mobile = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    await setupRoutes(mobile);
    const mp = await mobile.newPage();
    mp.on("pageerror", (e) => errors.push(e.message));
    await mp.goto(`${baseUrl}/profile/bob`);
    await mp.getByRole("heading", { name: "Bob Stone", exact: true }).waitFor();
    assert.equal(
      await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `PublicProfilePage overflow at ${width}x${height}`,
    );
    await mp.getByRole("button", { name: "Report", exact: true }).click();
    const mobileModal = mp.getByRole("dialog", { name: "Report user", exact: true });
    await mobileModal.waitFor();
    await assertRadioGeometry(mobileModal);
    assert.equal(
      await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `Profile ReportModal overflow at ${width}x${height}`,
    );
    if (width === 390 && process.env.REPORT_SCREENSHOT_DARK_MOBILE) {
      await mp.screenshot({ path: process.env.REPORT_SCREENSHOT_DARK_MOBILE });
    }
    await mobileModal.getByRole("button", { name: "Cancel", exact: true }).click();
    await mobileModal.waitFor({ state: "detached" });

    await mp.goto(`${baseUrl}/channels/${followedChannelId}/info`);
    await mp.locator(".channel-profile").waitFor();
    assert.equal(
      await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `ChannelInfoScreen overflow at ${width}x${height}`,
    );
    await mp.getByRole("button", { name: "Report channel", exact: true }).click();
    const mobileChannelModal = mp.getByRole("dialog", { name: "Report channel", exact: true });
    await mobileChannelModal.waitFor();
    await assertRadioGeometry(mobileChannelModal);
    assert.equal(
      await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `Channel ReportModal overflow at ${width}x${height}`,
    );
    await mobile.close();
  }
  console.log("PASS 6: dark mode + mobile (375px & 390px) zero overflow & aligned radios");

  assert.deepEqual(errors, []);
  console.log("ALL PUBLIC REPORT BROWSER CHECKS PASSED");
} finally {
  await browser.close();
}
