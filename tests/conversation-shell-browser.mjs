// Real Chromium verification for the reusable ConversationShell, system pills,
// doodle canvas, public channel reading, optimistic follow/unfollow, theming, i18n, and layout.
import assert from "node:assert/strict";
import { launchBrowser } from "./lib/browser.mjs";

const browser = await launchBrowser({ args: ["--no-sandbox"] });
const uid = (n) => `${String(n).padStart(8, "0")}-4444-4444-8444-444444444444`;
const me = uid(1);
const creator = uid(2);
const emptyChannelId = uid(100);
const postsChannelId = uid(101);
const directEmptyId = uid(200);
const directTodayId = uid(201);
const groupMultiDayId = uid(202);
const selfChatId = uid(203);

const baseUrl = process.env.TEST_BASE_URL ?? process.env.UI_BASE_URL ?? "http://127.0.0.1:5173";
const nowIso = () => new Date().toISOString();
const minutesAgo = (m) => new Date(Date.now() - m * 60_000).toISOString();
const daysAgo = (d, hour = 12) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  dt.setHours(hour, 0, 0, 0);
  return dt.toISOString();
};

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
    id: creator,
    username: "sofia_creator",
    display_name: "Sofia Creator",
    avatar_url: null,
    last_seen_at: nowIso(),
  },
];
const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(
  JSON.stringify({ sub: me, aal: "aal2", exp: Math.floor(Date.now() / 1000) + 3600 }),
).toString("base64url")}.signature`;

const channels = [
  {
    id: emptyChannelId,
    owner_id: creator,
    name: "Tech Announcements",
    slug: "tech-announcements",
    description: "Public product updates",
    follower_count: 42,
    is_verified: true,
    avatar_url: null,
    created_at: daysAgo(5),
    updated_at: daysAgo(5),
    last_message_id: null,
    last_message_at: null,
    last_message_preview: null,
  },
  {
    id: postsChannelId,
    owner_id: creator,
    name: "Daily Digest",
    slug: "daily-digest",
    description: "Public news posts",
    follower_count: 98,
    is_verified: false,
    avatar_url: null,
    created_at: daysAgo(10),
    updated_at: nowIso(),
    last_message_id: uid(5064),
    last_message_at: minutesAgo(1),
    last_message_preview: "Channel Post 64",
  },
];
let follows = [];
let failNextFollow = false;
let userSettings = {
  user_id: me,
  theme: "light",
  accent: "blue",
  language: "en",
  read_receipts_enabled: true,
};

const channelPosts = Array.from({ length: 65 }, (_, i) => ({
  id: uid(5000 + i),
  channel_id: postsChannelId,
  chat_id: null,
  sender_id: creator,
  type: "text",
  content: `Channel Post ${i}`,
  created_at: i < 5 ? daysAgo(2, 10 + i) : minutesAgo(65 - i),
  deleted_at: null,
  deleted_for_everyone: false,
  edited_at: null,
  is_pinned_in_chat: false,
  reply_to_message_id: null,
  reply_to_story_id: null,
  file_upload_id: null,
  media_thumbnail_upload_id: null,
  mentions: null,
  media_peaks: null,
  forwarded_from_message_id: null,
  location_data: null,
  contact_data: null,
}));

const chats = [
  {
    id: directEmptyId,
    type: "direct",
    name: null,
    direct_pair_key: `${me}::${creator}`,
    status: "active",
    avatar_url: null,
    community_id: null,
    created_at: nowIso(),
  },
  {
    id: directTodayId,
    type: "direct",
    name: null,
    direct_pair_key: `${me}::${creator}`,
    status: "active",
    avatar_url: null,
    community_id: null,
    created_at: nowIso(),
  },
  {
    id: groupMultiDayId,
    type: "group",
    name: "Design Crew",
    direct_pair_key: null,
    status: "active",
    avatar_url: null,
    community_id: null,
    created_at: daysAgo(3),
  },
  {
    id: selfChatId,
    type: "self",
    name: null,
    direct_pair_key: null,
    status: "active",
    avatar_url: null,
    community_id: null,
    created_at: nowIso(),
  },
];

const chatMessages = {
  [directEmptyId]: [],
  [directTodayId]: [
    {
      id: uid(6001),
      chat_id: directTodayId,
      channel_id: null,
      sender_id: creator,
      type: "text",
      content: "Hey there today!",
      created_at: minutesAgo(10),
      deleted_at: null,
      deleted_for_everyone: false,
      edited_at: null,
      is_pinned_in_chat: false,
      reply_to_message_id: null,
      reply_to_story_id: null,
      file_upload_id: null,
      media_thumbnail_upload_id: null,
      mentions: null,
      media_peaks: null,
      forwarded_from_message_id: null,
      location_data: null,
      contact_data: null,
    },
  ],
  [groupMultiDayId]: [
    {
      id: uid(6101),
      chat_id: groupMultiDayId,
      channel_id: null,
      sender_id: creator,
      type: "text",
      content: "Yesterday kickoff",
      created_at: daysAgo(1, 14),
      deleted_at: null,
      deleted_for_everyone: false,
      edited_at: null,
      is_pinned_in_chat: false,
      reply_to_message_id: null,
      reply_to_story_id: null,
      file_upload_id: null,
      media_thumbnail_upload_id: null,
      mentions: null,
      media_peaks: null,
      forwarded_from_message_id: null,
      location_data: null,
      contact_data: null,
    },
    {
      id: uid(6102),
      chat_id: groupMultiDayId,
      channel_id: null,
      sender_id: me,
      type: "text",
      content: "Today follow-up",
      created_at: minutesAgo(5),
      deleted_at: null,
      deleted_for_everyone: false,
      edited_at: null,
      is_pinned_in_chat: false,
      reply_to_message_id: null,
      reply_to_story_id: null,
      file_upload_id: null,
      media_thumbnail_upload_id: null,
      mentions: null,
      media_peaks: null,
      forwarded_from_message_id: null,
      location_data: null,
      contact_data: null,
    },
  ],
  [selfChatId]: [],
};

const errors = [];
const respond = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function setup(context) {
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
    const s = url.searchParams;
    const p = url.pathname;
    const method = req.method();
    const body =
      ["POST", "PATCH", "DELETE"].includes(method) &&
      req.postData() &&
      req.headers()["content-type"]?.includes("application/json")
        ? req.postDataJSON()
        : {};
    const object = req.headers().accept?.includes("object");
    const result = (arr) => respond(route, object ? (arr[0] ?? null) : arr);
    const filter = (arr) =>
      arr.filter((row) =>
        [...s].every(([k, v]) => !v.startsWith("eq.") || String(row[k]) === v.slice(3)),
      );

    if (p.endsWith("/user")) return respond(route, user);
    if (p.endsWith("/profiles")) return respond(route, profiles[0]);
    if (p.endsWith("/user_settings")) {
      if (method === "PATCH" || method === "POST") {
        userSettings = { ...userSettings, ...body };
      }
      return respond(route, userSettings);
    }
    if (p.endsWith("/profiles_visible")) return result(filter(profiles));
    if (p.endsWith("/user_blocks") || p.endsWith("/profiles_blocked")) return result([]);
    if (p.endsWith("/app_config")) return result([{ key: "avatar_gradient_palette", value: [] }]);
    if (p.endsWith("/chats")) {
      const id = s.get("id")?.slice(3);
      return result(chats.filter((c) => !id || c.id === id));
    }
    if (p.endsWith("/chat_members")) {
      const id = s.get("chat_id")?.slice(3);
      const members = [
        {
          chat_id: id,
          user_id: me,
          role: "admin",
          joined_at: "2020-01-01T00:00:00Z",
          manually_unread: false,
        },
        ...(id === selfChatId
          ? []
          : [
              {
                chat_id: id,
                user_id: creator,
                role: "member",
                joined_at: "2020-01-01T00:00:00Z",
                manually_unread: false,
              },
            ]),
      ];
      return result(members);
    }
    if (
      p.endsWith("/chat_requests") ||
      p.endsWith("/message_receipts") ||
      p.endsWith("/message_reactions") ||
      p.endsWith("/file_uploads")
    ) {
      return result([]);
    }
    if (p.endsWith("/channels")) return result(filter(channels));
    if (p.endsWith("/channel_followers")) {
      if (method === "PATCH") return result(filter(follows));
      return result(filter(follows));
    }
    if (p.endsWith("/messages")) {
      let rows = filter(channelPosts).sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (s.get("or")) {
        const at = s.get("or").match(/created_at\.lt\.([^,]+)/)?.[1];
        if (at) rows = rows.filter((r) => r.created_at < at);
      }
      return result(rows.slice(0, Number(s.get("limit") ?? 50)));
    }
    if (p.includes("/rpc/")) {
      const fn = p.split("/").at(-1);
      if (fn === "get_chat_messages") {
        const rows = [...(chatMessages[body.p_chat_id] ?? [])].sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        );
        return respond(route, rows);
      }
      if (fn === "follow_channel") {
        if (failNextFollow) {
          failNextFollow = false;
          return respond(route, { message: "Temporary error" }, 500);
        }
        if (!follows.some((f) => f.channel_id === body.p_channel_id)) {
          follows.push({
            channel_id: body.p_channel_id,
            user_id: me,
            followed_at: nowIso(),
            last_read_at: nowIso(),
            muted_until: null,
          });
          const ch = channels.find((c) => c.id === body.p_channel_id);
          if (ch) ch.follower_count += 1;
        }
        return respond(route, null);
      }
      if (fn === "unfollow_channel") {
        const before = follows.length;
        follows = follows.filter((f) => f.channel_id !== body.p_channel_id);
        if (follows.length < before) {
          const ch = channels.find((c) => c.id === body.p_channel_id);
          if (ch) ch.follower_count = Math.max(0, ch.follower_count - 1);
        }
        return respond(route, null);
      }
      return respond(route, null);
    }
    return respond(route, []);
  });
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await setup(desktop);
  const page = await desktop.newPage();
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. Empty, unfollowed channel
  await page.goto(`${baseUrl}/channels/${emptyChannelId}`);
  await page.locator('[data-slot="conversation-shell"]').waitFor();
  await page.locator('[data-slot="chat-doodle-pattern"]').waitFor();
  await page.locator('[data-slot="conversation-start-pill"]').waitFor();
  assert.equal(
    await page.locator('[data-slot="conversation-start-pill"]').textContent(),
    "Start of this conversation",
  );
  assert.equal(
    await page.locator('[data-slot="conversation-encryption-pill"]').textContent(),
    "Messages are end-to-end encrypted. No one outside of this chat can read or listen to them.",
  );
  const createdText = await page.locator('[data-slot="channel-created-pill"]').textContent();
  assert.equal(createdText, 'Channel "Tech Announcements" was created');
  assert.ok(!/sofia/i.test(createdText ?? ""), "Creator identity must never be exposed");
  assert.equal(await page.getByText("Follow this channel to see its posts.").count(), 0);
  await page.locator(".channel-header small").filter({ hasText: "42 followers" }).waitFor();
  const cta = page.locator('[data-slot="channel-follow-cta"]');
  await cta.waitFor();
  assert.equal(await cta.textContent(), "Follow channel");
  const ctaRadius = await cta.evaluate((el) =>
    Number.parseFloat(getComputedStyle(el).borderRadius),
  );
  assert.ok(ctaRadius >= 24, `CTA should be pill-shaped, got borderRadius=${ctaRadius}`);

  // Verify error rollback when follow_channel fails
  failNextFollow = true;
  await cta.click();
  await page
    .locator('[role="alert"]')
    .filter({ hasText: "Unable to follow channel. Try again." })
    .waitFor();
  await page.locator(".channel-header small").filter({ hasText: "42 followers" }).waitFor();
  await cta.waitFor();

  // 2. Live theme & contrast verification across light/dark x all 6 accents
  const themeAudit = await page.evaluate(() => {
    const parseRgb = (cssColor) => {
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.fillStyle = cssColor;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b];
    };
    const lum = ([r, g, b]) =>
      [r, g, b]
        .map((c) => {
          const v = c / 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        })
        .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => {
      const l1 = lum(a);
      const l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const root = document.documentElement;
    const prevTheme = root.dataset.theme;
    const prevClass = root.className;
    const out = [];
    for (const mode of ["light", "dark"]) {
      root.dataset.theme = mode;
      for (const accent of ["blue", "purple", "red", "orange", "yellow", "green"]) {
        for (const a of ["blue", "purple", "red", "orange", "yellow", "green"]) {
          root.classList.remove(`theme-${a}`);
        }
        root.classList.add(`theme-${accent}`);
        const ctaStyle = getComputedStyle(
          document.querySelector('[data-slot="channel-follow-cta"]'),
        );
        const pillStyle = getComputedStyle(document.querySelector(".system-pill"));
        const doodleStyle = getComputedStyle(
          document.querySelector('[data-slot="chat-doodle-pattern"]'),
        );
        out.push({
          mode,
          accent,
          ctaBg: ctaStyle.backgroundColor,
          ctaFg: ctaStyle.color,
          ctaContrast: ratio(parseRgb(ctaStyle.backgroundColor), parseRgb(ctaStyle.color)),
          pillContrast: ratio(parseRgb(pillStyle.backgroundColor), parseRgb(pillStyle.color)),
          doodleColor: doodleStyle.color,
        });
      }
    }
    root.dataset.theme = prevTheme;
    root.className = prevClass;
    return out;
  });
  for (const r of themeAudit) {
    assert.ok(
      r.pillContrast >= 4.5,
      `Pill contrast failed in ${r.mode}/${r.accent}: ${r.pillContrast.toFixed(2)}`,
    );
    if (r.mode === "light" && r.accent !== "yellow") {
      assert.equal(
        r.ctaFg,
        "rgb(255, 255, 255)",
        `CTA text should use light-mode --primary-foreground (white) in ${r.mode}/${r.accent}, got ${r.ctaFg}`,
      );
    } else {
      assert.ok(
        r.ctaContrast >= 4.5,
        `CTA contrast failed in ${r.mode}/${r.accent}: ${r.ctaContrast.toFixed(2)} (bg=${r.ctaBg}, fg=${r.ctaFg})`,
      );
    }
  }
  const lightBlue = themeAudit.find((r) => r.mode === "light" && r.accent === "blue");
  const darkBlue = themeAudit.find((r) => r.mode === "dark" && r.accent === "blue");
  assert.notEqual(
    lightBlue?.ctaFg,
    darkBlue?.ctaFg,
    "CTA text color must adapt dynamically between light and dark themes",
  );
  assert.equal(new Set(themeAudit.filter((r) => r.mode === "light").map((r) => r.ctaBg)).size, 6);
  assert.ok(new Set(themeAudit.map((r) => r.doodleColor)).size >= 6);

  // 3. Language switch (EN -> ES -> EN) with dynamic interpolation
  await page.goto(`${baseUrl}/settings/appearance`);
  const saveEs = page.waitForResponse(
    (r) => r.url().includes("/user_settings") && r.request().method() === "PATCH",
  );
  await page.locator("#language").selectOption("es");
  await page.waitForFunction(() => document.documentElement.lang === "es");
  await saveEs;
  await page.goto(`${baseUrl}/channels/${emptyChannelId}`);
  await page.locator('[data-slot="conversation-start-pill"]').waitFor();
  assert.equal(
    await page.locator('[data-slot="conversation-start-pill"]').textContent(),
    "Inicio de esta conversación",
  );
  assert.equal(
    await page.locator('[data-slot="conversation-encryption-pill"]').textContent(),
    "Los mensajes están cifrados de extremo a extremo. Nadie fuera de este chat puede leerlos ni escucharlos.",
  );
  assert.equal(
    await page.locator('[data-slot="channel-created-pill"]').textContent(),
    'Se creó el canal "Tech Announcements".',
  );
  assert.equal(
    await page.locator('[data-slot="channel-follow-cta"]').textContent(),
    "Seguir canal",
  );
  await page.goto(`${baseUrl}/settings/appearance`);
  const saveEn = page.waitForResponse(
    (r) => r.url().includes("/user_settings") && r.request().method() === "PATCH",
  );
  await page.locator("#language").selectOption("en");
  await page.waitForFunction(() => document.documentElement.lang === "en");
  await saveEn;

  // 4. Channel with 65 posts, NOT followed: readable, scroll to top shows pills, CTA pinned, follow/reload/unfollow
  await page.goto(`${baseUrl}/channels/${postsChannelId}`);
  await page.getByText("Channel Post 64", { exact: true }).waitFor();
  await page.locator('[data-slot="channel-follow-cta"]').waitFor();
  await page.locator(".channel-header small").filter({ hasText: "98 followers" }).waitFor();
  // Verify header stays fixed above scrolling list and CTA stays pinned below
  const beforeScroll = await page.evaluate(() => ({
    headerTop: document
      .querySelector('[data-slot="conversation-shell-header"]')
      .getBoundingClientRect().top,
    ctaBottom: document.querySelector('[data-slot="channel-follow-cta"]').getBoundingClientRect()
      .bottom,
  }));
  await page.locator(".message-list").evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.locator('[data-slot="conversation-start-pill"]').waitFor();
  await page.getByText("Channel Post 0", { exact: true }).waitFor();
  assert.equal(
    await page.locator('[data-slot="channel-created-pill"]').textContent(),
    'Channel "Daily Digest" was created',
  );
  const afterScroll = await page.evaluate(() => ({
    headerTop: document
      .querySelector('[data-slot="conversation-shell-header"]')
      .getBoundingClientRect().top,
    ctaBottom: document.querySelector('[data-slot="channel-follow-cta"]').getBoundingClientRect()
      .bottom,
  }));
  assert.equal(
    afterScroll.headerTop,
    beforeScroll.headerTop,
    "Header remains fixed while scrolling",
  );
  assert.equal(afterScroll.ctaBottom, beforeScroll.ctaBottom, "CTA remains pinned while scrolling");
  // Follow -> count increments, CTA disappears, persists across reload
  await page.locator('[data-slot="channel-follow-cta"]').click();
  await page.locator('[data-slot="channel-follow-cta"]').waitFor({ state: "detached" });
  await page.locator(".channel-header small").filter({ hasText: "99 followers" }).waitFor();
  await page.reload();
  await page.getByText("Channel Post 64", { exact: true }).waitFor();
  await page.locator(".channel-header small").filter({ hasText: "99 followers" }).waitFor();
  assert.equal(await page.locator('[data-slot="channel-follow-cta"]').count(), 0);
  // Unfollow via existing overflow menu -> restores CTA, decrements count, posts remain visible
  await page.getByRole("button", { name: "Channel options" }).click();
  await page.getByRole("menuitem", { name: "Unfollow", exact: true }).click();
  await page.locator('[data-slot="channel-follow-cta"]').waitFor();
  await page.locator(".channel-header small").filter({ hasText: "98 followers" }).waitFor();
  await page.getByText("Channel Post 64", { exact: true }).waitFor();

  // 5. Regular chats use the same shell: empty direct, today direct, multi-day group, self
  await page.goto(`${baseUrl}/chats/${directEmptyId}`);
  await page.locator('[data-slot="conversation-shell"]').waitFor();
  await page.locator('[data-slot="chat-doodle-pattern"]').waitFor();
  assert.equal(
    await page.locator('[data-slot="conversation-start-pill"]').textContent(),
    "Start of this conversation",
  );
  assert.equal(
    await page.locator('[data-slot="conversation-encryption-pill"]').textContent(),
    "Messages are end-to-end encrypted. No one outside of this chat can read or listen to them.",
  );
  assert.equal(await page.locator('[data-slot="channel-created-pill"]').count(), 0);
  assert.equal(await page.locator('[data-slot="channel-follow-cta"]').count(), 0);
  await page.locator(".conversation-composer").waitFor();

  await page.goto(`${baseUrl}/chats/${directTodayId}`);
  await page.getByText("Hey there today!", { exact: true }).waitFor();
  assert.equal(await page.locator(".message-date").filter({ hasText: "Today" }).count(), 0);

  await page.goto(`${baseUrl}/chats/${groupMultiDayId}`);
  await page.getByText("Yesterday kickoff", { exact: true }).waitFor();
  await page.getByText("Today follow-up", { exact: true }).waitFor();
  assert.equal(await page.locator(".message-date").filter({ hasText: "Yesterday" }).count(), 1);
  assert.equal(await page.locator(".message-date").filter({ hasText: "Today" }).count(), 1);

  await page.goto(`${baseUrl}/chats/${selfChatId}`);
  await page.locator('[data-slot="conversation-start-pill"]').waitFor();
  await page.locator('[data-slot="conversation-encryption-pill"]').waitFor();
  assert.equal(await page.locator('[data-slot="channel-created-pill"]').count(), 0);
  await page.locator(".conversation-composer").waitFor();

  await desktop.close();

  // 6. Mobile viewport (390x844): centered pills, pinned CTA, zero overflow
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await setup(mobile);
  const mp = await mobile.newPage();
  mp.on("pageerror", (e) => errors.push(e.message));
  await mp.goto(`${baseUrl}/channels/${emptyChannelId}`);
  await mp.locator('[data-slot="channel-follow-cta"]').waitFor();
  assert.ok(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const layout = await mp.evaluate(() => {
    const header = document
      .querySelector('[data-slot="conversation-shell-header"]')
      .getBoundingClientRect();
    const ctaRect = document
      .querySelector('[data-slot="channel-follow-cta"]')
      .getBoundingClientRect();
    const pills = [...document.querySelectorAll(".system-pill")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        centerOffset: Math.abs(r.left + r.width / 2 - innerWidth / 2),
      };
    });
    return {
      headerBottom: header.bottom,
      ctaTop: ctaRect.top,
      ctaLeft: ctaRect.left,
      ctaRight: ctaRect.right,
      innerWidth,
      pills,
    };
  });
  assert.ok(layout.ctaTop > layout.headerBottom);
  assert.ok(
    layout.ctaLeft >= 12 && layout.innerWidth - layout.ctaRight >= 12,
    "CTA has comfortable side margins",
  );
  for (const pill of layout.pills) {
    assert.ok(
      pill.left >= 0 && pill.right <= layout.innerWidth,
      "Pill stays inside mobile viewport",
    );
    assert.ok(pill.centerOffset <= 4, `Pill stays centered (offset=${pill.centerOffset})`);
  }
  await mobile.close();

  assert.deepEqual(errors, []);
  console.log(
    "PASS: conversation shell (empty/populated unfollowed channel, follow/reload/unfollow/error-rollback, direct/group/self chats, 12 theme contrast audit, EN/ES i18n, desktop & mobile layout).",
  );
} finally {
  await browser.close();
}
