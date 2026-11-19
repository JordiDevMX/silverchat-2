import assert from "node:assert/strict";
import { launchBrowser } from "./lib/browser.mjs";

const browser = await launchBrowser({ args: ["--no-sandbox"] });
const baseUrl = process.env.TEST_BASE_URL ?? process.env.UI_BASE_URL ?? "http://127.0.0.1:5176";
const uid = (n) => `${String(n).padStart(8, "0")}-5555-4555-8555-555555555555`;

const me = uid(1);
const sofia = uid(2);
const carol = uid(3);
const dave = uid(4);

const ownedEmptyChannelId = uid(100);
const ownedEsChannelId = uid(101);
const ownedPopulatedChannelId = uid(102);
const followedEmptyChannelId = uid(103);

const creatorEmptyGroupId = uid(200);
const adminEmptyGroupId = uid(201);
const memberEmptyGroupId = uid(202);
const populatedGroupId = uid(203);
const communityCreatorEmptyId = uid(204);
const communityMemberEmptyId = uid(205);
const directSofiaChatId = uid(300);

const user = {
  id: me,
  email: "alice@example.test",
  aud: "authenticated",
  role: "authenticated",
  user_metadata: {},
  app_metadata: {},
  factors: [],
};

const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(
  JSON.stringify({ sub: me, aal: "aal2", exp: Math.floor(Date.now() / 1000) + 3600 }),
).toString("base64url")}.signature`;

const profiles = [
  { id: me, username: "alice", display_name: "Alice Rivera", avatar_url: null, bio: null },
  {
    id: sofia,
    username: "sofia",
    display_name: "Sofia Reyes",
    avatar_url: "avatars/sofia.svg",
    bio: null,
  },
  { id: carol, username: "carol", display_name: "Carol Chen", avatar_url: null, bio: null },
  { id: dave, username: "dave", display_name: "Dave Park", avatar_url: null, bio: null },
];

const avatarBytes = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#0ea5e9"/></svg>',
);

const now = () => new Date().toISOString();

const channels = [
  {
    id: ownedEmptyChannelId,
    owner_id: me,
    name: "Silver Updates",
    slug: "silver-updates",
    description: null,
    follower_count: 100,
    is_verified: false,
    avatar_url: "avatars/channel.svg",
    created_at: now(),
    updated_at: now(),
    last_message_at: null,
    last_message_preview: null,
  },
  {
    id: ownedEsChannelId,
    owner_id: me,
    name: "Noticias Silver",
    slug: "noticias-silver",
    description: "Noticias diarias",
    follower_count: 1,
    is_verified: false,
    avatar_url: null,
    created_at: now(),
    updated_at: now(),
    last_message_at: null,
    last_message_preview: null,
  },
  {
    id: ownedPopulatedChannelId,
    owner_id: me,
    name: "Active Channel",
    slug: "active-channel",
    description: "Has posts",
    follower_count: 5,
    is_verified: false,
    avatar_url: null,
    created_at: now(),
    updated_at: now(),
    last_message_at: now(),
    last_message_preview: "Hello world",
  },
  {
    id: followedEmptyChannelId,
    owner_id: sofia,
    name: "Sofia Channel",
    slug: "sofia-channel",
    description: null,
    follower_count: 0,
    is_verified: false,
    avatar_url: null,
    created_at: now(),
    updated_at: now(),
    last_message_at: null,
    last_message_preview: null,
  },
];

const channelFollows = [
  {
    channel_id: ownedEmptyChannelId,
    user_id: me,
    followed_at: now(),
    last_read_at: now(),
    muted_until: null,
  },
  {
    channel_id: ownedEsChannelId,
    user_id: me,
    followed_at: now(),
    last_read_at: now(),
    muted_until: null,
  },
  {
    channel_id: ownedPopulatedChannelId,
    user_id: me,
    followed_at: now(),
    last_read_at: now(),
    muted_until: null,
  },
  {
    channel_id: followedEmptyChannelId,
    user_id: me,
    followed_at: now(),
    last_read_at: now(),
    muted_until: null,
  },
];

const chats = [
  {
    id: creatorEmptyGroupId,
    type: "group",
    status: "active",
    name: "Launch Group",
    description: null,
    avatar_url: null,
    created_by: me,
    created_at: now(),
    updated_at: now(),
    community_id: null,
    direct_pair_key: null,
  },
  {
    id: adminEmptyGroupId,
    type: "group",
    status: "active",
    name: "Admin Group",
    description: "Team coordination",
    avatar_url: null,
    created_by: sofia,
    created_at: now(),
    updated_at: now(),
    community_id: null,
    direct_pair_key: null,
  },
  {
    id: memberEmptyGroupId,
    type: "group",
    status: "active",
    name: "Member Group",
    description: null,
    avatar_url: null,
    created_by: sofia,
    created_at: now(),
    updated_at: now(),
    community_id: null,
    direct_pair_key: null,
  },
  {
    id: populatedGroupId,
    type: "group",
    status: "active",
    name: "Busy Group",
    description: "Already active",
    avatar_url: null,
    created_by: me,
    created_at: now(),
    updated_at: now(),
    community_id: null,
    direct_pair_key: null,
  },
  {
    id: communityCreatorEmptyId,
    type: "community_chat",
    status: "active",
    name: "Town Square",
    description: null,
    avatar_url: null,
    created_by: me,
    created_at: now(),
    updated_at: now(),
    community_id: null,
    direct_pair_key: null,
  },
  {
    id: communityMemberEmptyId,
    type: "community_chat",
    status: "active",
    name: "Quiet Town",
    description: null,
    avatar_url: null,
    created_by: sofia,
    created_at: now(),
    updated_at: now(),
    community_id: null,
    direct_pair_key: null,
  },
  {
    id: directSofiaChatId,
    type: "direct",
    status: "active",
    name: null,
    description: null,
    avatar_url: null,
    created_by: me,
    created_at: now(),
    updated_at: now(),
    community_id: null,
    direct_pair_key: [me, sofia].sort().join("::"),
    last_message_at: now(),
  },
];

const makeMember = (chat_id, user_id, role = "member") => ({
  chat_id,
  user_id,
  role,
  joined_at: "2026-01-01T00:00:00Z",
  last_read_at: null,
  muted_until: null,
  pinned_at: null,
  archived_at: null,
  favorited_at: null,
  manually_unread: false,
});

const chatMembers = [
  makeMember(creatorEmptyGroupId, me, "admin"),
  makeMember(creatorEmptyGroupId, sofia, "member"),
  makeMember(creatorEmptyGroupId, carol, "member"),
  makeMember(adminEmptyGroupId, sofia, "admin"),
  makeMember(adminEmptyGroupId, me, "admin"),
  makeMember(memberEmptyGroupId, sofia, "admin"),
  makeMember(memberEmptyGroupId, me, "member"),
  makeMember(populatedGroupId, me, "admin"),
  makeMember(populatedGroupId, sofia, "member"),
  makeMember(communityCreatorEmptyId, me, "admin"),
  makeMember(communityCreatorEmptyId, sofia, "member"),
  makeMember(communityMemberEmptyId, sofia, "admin"),
  makeMember(communityMemberEmptyId, me, "member"),
  makeMember(directSofiaChatId, me, "member"),
  makeMember(directSofiaChatId, sofia, "member"),
];

const messages = [
  {
    id: uid(900),
    chat_id: null,
    channel_id: ownedPopulatedChannelId,
    sender_id: me,
    type: "text",
    content: "Existing channel post",
    created_at: now(),
    deleted_at: null,
    deleted_for_everyone: false,
    is_pinned_in_chat: false,
    reply_to_message_id: null,
    reply_to_story_id: null,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    mentions: null,
  },
  {
    id: uid(901),
    chat_id: populatedGroupId,
    channel_id: null,
    sender_id: me,
    type: "text",
    content: "Existing group message",
    created_at: now(),
    deleted_at: null,
    deleted_for_everyone: false,
    is_pinned_in_chat: false,
    reply_to_message_id: null,
    reply_to_story_id: null,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    mentions: null,
  },
];

let userSettings = {
  user_id: me,
  theme: "light",
  accent: "blue",
  language: "en",
  read_receipts_enabled: true,
};
const storyCalls = [];
const addedMembersCalls = [];
const insertedMessages = [];
const errors = [];

const respond = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function setupRoutes(context) {
  await context.addInitScript(() => {
    window.__copiedTexts = [];
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text) => {
          window.__copiedTexts.push(text);
        },
      },
      configurable: true,
    });
  });

  await context.route("**/api/auth/**", (route) =>
    respond(route, {
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
    const body =
      ["POST", "PATCH", "DELETE"].includes(method) &&
      req.postData() &&
      req.headers()["content-type"]?.includes("application/json")
        ? req.postDataJSON()
        : {};

    const result = (rows) =>
      respond(route, req.headers().accept?.includes("object") ? (rows[0] ?? null) : rows);

    const filterEq = (rows) =>
      rows
        .filter((row) =>
          [...s].every(([k, v]) => {
            if (!v.startsWith("eq.")) return true;
            if (k === "chat.type") return true;
            if (k === "chat.status") return true;
            return String(row[k]) === v.slice(3);
          }),
        )
        .filter((row) => {
          if (!s.has("id")) return true;
          const idParam = s.get("id");
          if (idParam.startsWith("in.")) return idParam.includes(row.id);
          return true;
        });

    if (p.endsWith("/user")) return respond(route, user);
    if (p.endsWith("/profiles")) return respond(route, profiles[0]);
    if (p.endsWith("/profiles_visible")) {
      let rows = filterEq(profiles);
      if (s.has("id") && s.get("id").startsWith("neq.")) {
        rows = rows.filter((r) => r.id !== s.get("id").slice(4));
      }
      if (s.has("or")) {
        const term =
          s
            .get("or")
            .match(/%([^%]+)%/)?.[1]
            ?.toLowerCase() ?? "";
        rows = rows.filter(
          (r) =>
            r.username.toLowerCase().includes(term) || r.display_name.toLowerCase().includes(term),
        );
      }
      return result(rows);
    }
    if (p.endsWith("/user_settings")) {
      if (method === "PATCH" || method === "POST") {
        userSettings = { ...userSettings, ...body };
      }
      return respond(route, userSettings);
    }
    if (p.endsWith("/app_config")) return result([{ key: "avatar_gradient_palette", value: [] }]);
    if (p.endsWith("/user_blocks")) return result([]);
    if (p.endsWith("/stories")) return result([]);
    if (p.endsWith("/story_views")) return result([]);
    if (p.endsWith("/message_receipts")) return result([]);
    if (p.endsWith("/message_reactions")) return result([]);
    if (p.endsWith("/file_uploads")) return result([]);

    if (p.includes("/storage/v1/object/sign/")) {
      const key = decodeURIComponent(p.split("/object/sign/")[1]);
      if (method === "POST") return respond(route, { signedURL: `/object/sign/${key}?token=fake` });
      return route.fulfill({ status: 200, contentType: "image/svg+xml", body: avatarBytes });
    }

    if (p.endsWith("/channels")) return result(filterEq(channels));
    if (p.endsWith("/channel_followers")) return result(filterEq(channelFollows));

    if (p.endsWith("/chats")) {
      return result(filterEq(chats));
    }
    if (p.endsWith("/chat_members")) {
      let rows = filterEq(chatMembers);
      if (s.get("select")?.includes("chat:chats")) {
        rows = rows
          .map((m) => ({ ...m, chat: chats.find((c) => c.id === m.chat_id) }))
          .filter((m) => {
            if (!m.chat) return false;
            if (s.get("chat.type") && `eq.${m.chat.type}` !== s.get("chat.type")) return false;
            if (s.get("chat.status") && `eq.${m.chat.status}` !== s.get("chat.status"))
              return false;
            return true;
          });
      }
      return result(rows);
    }
    if (p.endsWith("/chat_requests")) return result([]);

    if (p.endsWith("/messages")) {
      if (method === "POST") {
        const row = { ...body, created_at: now(), deleted_for_everyone: false };
        messages.push(row);
        insertedMessages.push(row);
        return result([row]);
      }
      return result(filterEq(messages));
    }

    if (p.endsWith("/rpc/get_chat_messages")) {
      return respond(
        route,
        messages.filter((m) => m.chat_id === body.p_chat_id),
      );
    }
    if (p.endsWith("/rpc/create_story")) {
      storyCalls.push(body);
      return respond(route, uid(500 + storyCalls.length));
    }
    if (p.endsWith("/rpc/add_chat_members")) {
      addedMembersCalls.push(body);
      for (const id of body.p_user_ids) {
        if (!chatMembers.some((m) => m.chat_id === body.p_chat_id && m.user_id === id)) {
          chatMembers.push(makeMember(body.p_chat_id, id, "member"));
        }
      }
      return respond(route, body.p_user_ids.length);
    }
    if (p.endsWith("/rpc/mark_chat_as_read")) return respond(route, null);

    return result([]);
  });
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  await setupRoutes(context);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.message));

  const goto = (path) => page.goto(`${baseUrl}${path}`);

  // 1. Channel owner on empty 100-follower channel (auto-show + visual + background + edit description + persistence)
  await goto(`/channels/${ownedEmptyChannelId}`);
  const dialog = page.locator('[data-slot="chat-growth-dialog"]');
  await dialog.waitFor();
  assert.equal(await dialog.getAttribute("data-chat-type"), "channel");

  const layoutCheck = await page.evaluate(() => {
    const dlg = document.querySelector('[data-slot="chat-growth-dialog"]');
    const header = document.querySelector(".channel-header");
    const composer = document.querySelector('[data-slot="composer-dock"]');
    const addDesc = document.querySelector(".chat-growth-add-description");
    const primaryBtn = document.querySelector('[data-slot="growth-share-status"]');
    const secondaryBtn = document.querySelector('[data-slot="growth-secondary-action"]');
    const avatar = document.querySelector('.chat-growth-avatar [data-slot="avatar"]');
    const primaryProbe = document.createElement("span");
    primaryProbe.style.color = "var(--primary)";
    document.body.appendChild(primaryProbe);
    const expectedPrimary = getComputedStyle(primaryProbe).color;
    primaryProbe.remove();
    return {
      title: dlg.querySelector(".chat-growth-title")?.textContent,
      subtitle: dlg.querySelector(".chat-growth-subtitle")?.textContent,
      addDescText: addDesc?.textContent,
      addDescColor: addDesc ? getComputedStyle(addDesc).color : null,
      expectedPrimary,
      headerRect: header?.getBoundingClientRect().toJSON(),
      composerRect: composer?.getBoundingClientRect().toJSON(),
      btn1Bg: primaryBtn ? getComputedStyle(primaryBtn).backgroundColor : null,
      btn1Border: primaryBtn ? getComputedStyle(primaryBtn).borderTopWidth : null,
      btn1Rect: primaryBtn?.getBoundingClientRect().toJSON(),
      btn2Rect: secondaryBtn?.getBoundingClientRect().toJSON(),
      avatarRect: avatar?.getBoundingClientRect().toJSON(),
      avatarRadius: avatar ? getComputedStyle(avatar).borderRadius : null,
    };
  });

  assert.equal(layoutCheck.title, "You created 'Silver Updates'");
  assert.equal(layoutCheck.subtitle, "Channel - 100 followers");
  assert.equal(layoutCheck.addDescText, "add a description");
  assert.equal(layoutCheck.addDescColor, layoutCheck.expectedPrimary);
  assert.ok(layoutCheck.headerRect.height > 0 && layoutCheck.composerRect.height > 0);
  assert.equal(layoutCheck.btn1Bg, "rgba(0, 0, 0, 0)");
  assert.equal(layoutCheck.btn1Border, "1px");
  assert.ok(layoutCheck.btn2Rect.top > layoutCheck.btn1Rect.bottom);
  assert.ok(Math.abs(layoutCheck.avatarRect.width - layoutCheck.avatarRect.height) <= 1);
  assert.ok(
    layoutCheck.avatarRadius === "50%" ||
      Number.parseFloat(layoutCheck.avatarRadius) >= layoutCheck.avatarRect.width / 2 - 0.5,
  );

  // Live theme accent token updates empty-description color
  await page.evaluate(() => {
    document.documentElement.classList.add("theme-purple");
  });
  const purpleColor = await page.evaluate(() => {
    const addDesc = document.querySelector(".chat-growth-add-description");
    const probe = document.createElement("span");
    probe.style.color = "var(--primary)";
    document.body.appendChild(probe);
    const expected = getComputedStyle(probe).color;
    probe.remove();
    return { actual: getComputedStyle(addDesc).color, expected };
  });
  assert.equal(purpleColor.actual, purpleColor.expected);

  // Clicking empty description opens edit channel flow on ChannelInfoScreen
  await dialog.locator(".chat-growth-add-description").click();
  await page.waitForURL(`**/channels/${ownedEmptyChannelId}/info?edit=1`);
  await page.getByRole("dialog", { name: "Edit channel", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: "Edit channel", exact: true })
    .waitFor({ state: "detached" });

  // Reopen from ChannelInfoScreen SettingsRow
  await page.getByRole("button", { name: "Grow channel", exact: true }).click();
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  assert.ok(
    await page
      .getByRole("button", { name: "Grow channel", exact: true })
      .evaluate((el) => el === document.activeElement),
  );

  // Dismissal persists across reload on channel view
  await goto(`/channels/${ownedEmptyChannelId}`);
  await page.locator('[data-slot="composer-dock"]').waitFor();
  await page.waitForTimeout(150);
  assert.equal(await dialog.count(), 0);

  // Reopen via ChatOptionsMenu, dismiss via Escape (returns focus), then backdrop click
  const optionsBtn = page.getByRole("button", { name: "Channel options", exact: true });
  await optionsBtn.click();
  await page.getByRole("menuitem", { name: "Grow channel", exact: true }).click();
  await dialog.waitFor();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.ok(await optionsBtn.evaluate((el) => el === document.activeElement));

  await optionsBtn.click();
  await page.getByRole("menuitem", { name: "Grow channel", exact: true }).click();
  await dialog.waitFor();
  await page.mouse.click(8, 8);
  await dialog.waitFor({ state: "detached" });

  // Action 1: Share to my status -> prefilled StoryCreator text mode
  await optionsBtn.click();
  await page.getByRole("menuitem", { name: "Grow channel", exact: true }).click();
  await dialog.waitFor();
  await dialog.locator('[data-slot="growth-share-status"]').click();
  const storyDialog = page.getByRole("dialog", { name: "Create story", exact: true });
  await storyDialog.waitFor();
  const storyText = await storyDialog
    .getByRole("textbox", { name: "Story text", exact: true })
    .inputValue();
  assert.ok(storyText.includes("Silver Updates"));
  assert.ok(storyText.includes(`/channels/${ownedEmptyChannelId}`));
  await storyDialog.getByRole("button", { name: "Send story", exact: true }).click();
  await storyDialog.waitFor({ state: "detached" });
  assert.equal(storyCalls.length, 1);

  // Action 2: Invite admins -> copy link + DM invite
  await optionsBtn.click();
  await page.getByRole("menuitem", { name: "Grow channel", exact: true }).click();
  await dialog.waitFor();
  await dialog.locator('[data-slot="growth-secondary-action"]').click();
  const inviteDialog = page.getByRole("dialog", { name: "Invite admins", exact: true });
  await inviteDialog.waitFor();
  await inviteDialog.getByRole("button", { name: "Copy link", exact: true }).click();
  assert.equal(
    (await page.evaluate(() => window.__copiedTexts)).at(-1),
    `${baseUrl}/channels/${ownedEmptyChannelId}`,
  );
  await inviteDialog.getByRole("button", { name: /Sofia Reyes/ }).click();
  await inviteDialog.waitFor({ state: "detached" });
  assert.equal(insertedMessages.length, 1);
  assert.ok(insertedMessages[0].content.includes(`/channels/${ownedEmptyChannelId}`));

  // 2. Spanish copy + singular follower + non-empty description
  await goto("/settings/appearance");
  const saveEs = page.waitForResponse(
    (r) => r.url().includes("/user_settings") && ["PATCH", "POST"].includes(r.request().method()),
  );
  await page.locator("#language").selectOption("es");
  await page.waitForFunction(() => document.documentElement.lang === "es");
  await saveEs;
  await goto(`/channels/${ownedEsChannelId}`);
  await dialog.waitFor();
  assert.equal(
    await dialog.locator(".chat-growth-title").textContent(),
    "Creaste 'Noticias Silver'",
  );
  assert.equal(await dialog.locator(".chat-growth-subtitle").textContent(), "Canal - 1 seguidor");
  assert.equal(await dialog.locator(".chat-growth-description").textContent(), "Noticias diarias");
  assert.equal(
    await dialog.locator('[data-slot="growth-share-status"]').textContent(),
    "Compartir en mi estado",
  );
  assert.equal(
    await dialog.locator('[data-slot="growth-secondary-action"]').textContent(),
    "Invitar a administradores",
  );
  await page.keyboard.press("Escape");

  // Switch back to EN
  await goto("/settings/appearance");
  const saveEn = page.waitForResponse(
    (r) => r.url().includes("/user_settings") && ["PATCH", "POST"].includes(r.request().method()),
  );
  await page.locator("#language").selectOption("en");
  await page.waitForFunction(() => document.documentElement.lang === "en");
  await saveEn;

  // 3. No auto-show for regular follower or non-empty channel
  await goto(`/channels/${followedEmptyChannelId}`);
  await page.locator('[data-slot="channel-created-pill"]').waitFor();
  await page.waitForTimeout(150);
  assert.equal(await dialog.count(), 0);
  await optionsBtn.click();
  assert.equal(await page.getByRole("menuitem", { name: "Grow channel", exact: true }).count(), 0);
  await page.keyboard.press("Escape");

  await goto(`/channels/${ownedPopulatedChannelId}`);
  await page.getByText("Existing channel post", { exact: true }).waitFor();
  await page.waitForTimeout(150);
  assert.equal(await dialog.count(), 0);

  // 4. Groups: creator empty, non-creator admin empty, regular member empty, populated group
  await goto(`/chats/${creatorEmptyGroupId}`);
  await dialog.waitFor();
  assert.equal(await dialog.getAttribute("data-chat-type"), "group");
  assert.equal(
    await dialog.locator(".chat-growth-title").textContent(),
    "You created 'Launch Group'",
  );
  assert.equal(await dialog.locator(".chat-growth-subtitle").textContent(), "Group - 3 members");
  await dialog.locator(".chat-growth-add-description").click();
  await page.waitForURL(`**/chats/${creatorEmptyGroupId}/info?focus=description`);
  assert.ok(
    await page
      .getByRole("textbox", { name: "Description", exact: true })
      .evaluate((el) => el === document.activeElement),
  );
  await page.getByRole("button", { name: "Grow group", exact: true }).click();
  await dialog.waitFor();
  await dialog.locator('[data-slot="growth-secondary-action"]').click();
  const addMembersDlg = page.getByRole("dialog", { name: "Add members", exact: true });
  await addMembersDlg.waitFor();
  await addMembersDlg.getByRole("searchbox").fill("dave");
  await addMembersDlg.getByRole("checkbox").last().check();
  await addMembersDlg.getByRole("button", { name: "Add 1 members", exact: true }).click();
  await addMembersDlg.waitFor({ state: "detached" });
  assert.equal(addedMembersCalls.length, 1);

  await goto(`/chats/${adminEmptyGroupId}`);
  await dialog.waitFor();
  assert.equal(
    await dialog.locator(".chat-growth-title").textContent(),
    "You manage 'Admin Group'",
  );
  assert.equal(await dialog.locator(".chat-growth-subtitle").textContent(), "Group - 2 members");
  await page.keyboard.press("Escape");

  await goto(`/chats/${memberEmptyGroupId}`);
  await page.locator('[data-slot="composer-dock"]').waitFor();
  await page.waitForTimeout(150);
  assert.equal(await dialog.count(), 0);
  await page.getByRole("button", { name: "Chat options", exact: true }).click();
  assert.equal(await page.getByRole("menuitem", { name: "Grow group", exact: true }).count(), 0);
  await page.keyboard.press("Escape");

  await goto(`/chats/${populatedGroupId}`);
  await page.getByText("Existing group message", { exact: true }).waitFor();
  await page.waitForTimeout(150);
  assert.equal(await dialog.count(), 0);
  await page.getByRole("button", { name: "Chat options", exact: true }).click();
  await page.getByRole("menuitem", { name: "Grow group", exact: true }).click();
  await dialog.waitFor();
  await page.keyboard.press("Escape");

  // 5. Community chat: creator empty vs regular member empty
  await goto(`/chats/${communityCreatorEmptyId}`);
  await dialog.waitFor();
  assert.equal(await dialog.getAttribute("data-chat-type"), "community_chat");
  assert.equal(
    await dialog.locator(".chat-growth-title").textContent(),
    "You created 'Town Square'",
  );
  assert.equal(
    await dialog.locator(".chat-growth-subtitle").textContent(),
    "Community - 2 members",
  );
  await dialog.locator('[data-slot="growth-secondary-action"]').click();
  await page.getByRole("dialog", { name: "Invite members", exact: true }).waitFor();
  await page.keyboard.press("Escape");

  await goto(`/chats/${communityMemberEmptyId}`);
  await page.locator('[data-slot="composer-dock"]').waitFor();
  await page.waitForTimeout(150);
  assert.equal(await dialog.count(), 0);

  // 6. Mobile viewport checks (390x844) with fresh storage
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await setupRoutes(mobileCtx);
  const mp = await mobileCtx.newPage();
  mp.setDefaultTimeout(10000);
  mp.on("pageerror", (e) => errors.push(e.message));

  await mp.goto(`${baseUrl}/channels/${ownedEmptyChannelId}`);
  const mobileDialog = mp.locator('[data-slot="chat-growth-dialog"]');
  await mobileDialog.waitFor();
  const mobileBox = await mobileDialog.boundingBox();
  assert.ok(mobileBox.x >= 0 && mobileBox.x + mobileBox.width <= 390);
  assert.equal(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mp.keyboard.press("Escape");
  await mobileDialog.waitFor({ state: "detached" });

  await mp.goto(`${baseUrl}/chats/${creatorEmptyGroupId}`);
  await mobileDialog.waitFor();
  const mobileGroupBox = await mobileDialog.boundingBox();
  assert.ok(mobileGroupBox.x >= 0 && mobileGroupBox.x + mobileGroupBox.width <= 390);
  assert.equal(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mp.keyboard.press("Escape");

  assert.deepEqual(errors, []);
  console.log(
    "PASS: ChatGrowthDialog verified across channel, group, and community_chat (desktop + mobile, EN + ES, role & empty triggers, persistence, reopen, empty-description affordance, and both action buttons).",
  );
} catch (err) {
  console.error("Browser check failed:", errors, err);
  throw err;
} finally {
  await browser.close();
}
