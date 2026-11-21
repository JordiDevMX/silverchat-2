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
  // System events in creatorEmptyGroupId must NOT count as user messages and must render BELOW the card
  {
    id: uid(902),
    chat_id: creatorEmptyGroupId,
    channel_id: null,
    sender_id: me,
    type: "system",
    content: "Alice added Sofia",
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
const sentChannelInvites = [];
const sockets = new Map();
const errors = [];
let sendDelayMs = 0;

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
            if (k === "chat.type" || k === "chat.status") return true;
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

    if (p.endsWith("/channels") || p.endsWith("/channels_public")) {
      const stripOwner = p.endsWith("/channels_public");
      const list = filterEq(channels).map((c) => {
        if (!stripOwner) return c;
        const { owner_id: _o, ...rest } = c;
        return rest;
      });
      return result(list);
    }
    if (p.endsWith("/channel_followers")) return result(filterEq(channelFollows));
    if (p.endsWith("/rpc/get_channel_viewer_context")) {
      const ch = channels.find((c) => c.id === body.p_channel_id);
      const isOwner = ch?.owner_id === me;
      const following = channelFollows.some(
        (f) => f.channel_id === body.p_channel_id && f.user_id === me,
      );
      return respond(route, {
        viewer_role: isOwner ? "owner" : following ? "follower" : "visitor",
        following,
      });
    }
    if (p.endsWith("/rpc/get_channel_messages")) {
      return respond(
        route,
        messages
          .filter((m) => m.channel_id === body.p_channel_id && !m.deleted_for_everyone)
          .slice(0, body.p_limit ?? 100),
      );
    }

    if (p.endsWith("/chats")) return result(filterEq(chats));
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
        if (sendDelayMs > 0) await new Promise((r) => setTimeout(r, sendDelayMs));
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
    if (p.endsWith("/channel_invitations_sent")) return result([]);
    if (p.endsWith("/rpc/send_channel_invitations")) {
      sentChannelInvites.push(body);
      return respond(
        route,
        (body.p_invitations ?? []).map((item) => ({
          recipient_id: item.recipient_id,
          id: item.id,
          ok: true,
        })),
      );
    }

    return result([]);
  });

  await context.routeWebSocket("**/realtime/v1/websocket*", (socket) =>
    socket.onMessage((raw) => {
      const [join, ref, topic, event, payload] = JSON.parse(String(raw));
      if (event === "phx_join") {
        const config = (payload.config.postgres_changes ?? []).map((c, i) => ({
          ...c,
          id: i + 1,
        }));
        sockets.set(topic, { socket, config });
        socket.send(
          JSON.stringify([
            join,
            ref,
            topic,
            "phx_reply",
            { status: "ok", response: { postgres_changes: config } },
          ]),
        );
      }
      if (event === "heartbeat") {
        socket.send(
          JSON.stringify([join, ref, topic, "phx_reply", { status: "ok", response: {} }]),
        );
      }
    }),
  );
}

const emitRealtimeInsert = (table, filterValue, record) => {
  for (const [topic, { socket, config }] of sockets) {
    const ids = config
      .filter((c) => c.table === table && (!c.filter || c.filter === filterValue))
      .map((c) => c.id);
    if (ids.length) {
      socket.send(
        JSON.stringify([
          null,
          null,
          topic,
          "postgres_changes",
          {
            ids,
            data: {
              schema: "public",
              table,
              type: "INSERT",
              columns: Object.keys(record).map((name) => ({ name, type: "text" })),
              record,
              old_record: {},
            },
          },
        ]),
      );
    }
  }
};

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  await setupRoutes(context);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.stack ?? e.message));

  const goto = (path) => page.goto(`${baseUrl}${path}`);
  const card = page.locator('[data-slot="chat-growth-card"]');

  // 1. Channel owner on empty 100-follower channel: inline region card (NO modal/dialog/close/backdrop)
  await goto(`/channels/${ownedEmptyChannelId}`);
  await card.waitFor();
  assert.equal(await card.getAttribute("data-chat-type"), "channel");
  assert.equal(await page.locator("dialog, [role='dialog']").count(), 0);
  assert.equal(await card.getByRole("button", { name: /Close|Cerrar/ }).count(), 0);
  assert.equal(await page.getByRole("region", { name: "You created 'Silver Updates'" }).count(), 1);

  const layoutCheck = await page.evaluate(() => {
    const el = document.querySelector('[data-slot="chat-growth-card"]');
    const list = document.querySelector(".message-list");
    const enc = document.querySelector('[data-slot="conversation-encryption-pill"]');
    const createdPill = document.querySelector('[data-slot="channel-created-pill"]');
    const header = document.querySelector(".channel-header");
    const composer = document.querySelector('[data-slot="composer-dock"]');
    const addDesc = document.querySelector(".chat-growth-add-description");
    const primaryBtn = document.querySelector('[data-slot="growth-share-status"]');
    const secondaryBtn = document.querySelector('[data-slot="growth-secondary-action"]');
    const avatar = document.querySelector('.chat-growth-avatar [data-slot="avatar"]');
    const probe = document.createElement("span");
    probe.style.color = "var(--primary)";
    document.body.appendChild(probe);
    const expectedPrimary = getComputedStyle(probe).color;
    probe.remove();

    const posEncVsCard = enc.compareDocumentPosition(el);
    const posCardVsCreated = el.compareDocumentPosition(createdPill);

    return {
      insideMessageList: list.contains(el),
      positionStyle: getComputedStyle(el).position,
      afterEncryption: Boolean(posEncVsCard & Node.DOCUMENT_POSITION_FOLLOWING),
      beforeCreatedPill: Boolean(posCardVsCreated & Node.DOCUMENT_POSITION_FOLLOWING),
      title: el.querySelector(".chat-growth-title")?.textContent,
      subtitle: el.querySelector(".chat-growth-subtitle")?.textContent,
      addDescText: addDesc?.textContent,
      addDescColor: addDesc ? getComputedStyle(addDesc).color : null,
      expectedPrimary,
      headerRect: header?.getBoundingClientRect().toJSON(),
      composerRect: composer?.getBoundingClientRect().toJSON(),
      cardRect: el.getBoundingClientRect().toJSON(),
      listRect: list.getBoundingClientRect().toJSON(),
      btn1Bg: primaryBtn ? getComputedStyle(primaryBtn).backgroundColor : null,
      btn1Border: primaryBtn ? getComputedStyle(primaryBtn).borderTopWidth : null,
      btn1Rect: primaryBtn?.getBoundingClientRect().toJSON(),
      btn2Rect: secondaryBtn?.getBoundingClientRect().toJSON(),
      avatarRect: avatar?.getBoundingClientRect().toJSON(),
      avatarRadius: avatar ? getComputedStyle(avatar).borderRadius : null,
    };
  });

  assert.equal(layoutCheck.insideMessageList, true);
  assert.equal(layoutCheck.positionStyle, "static");
  assert.equal(layoutCheck.afterEncryption, true);
  assert.equal(layoutCheck.beforeCreatedPill, true);
  assert.equal(layoutCheck.title, "You created 'Silver Updates'");
  assert.equal(layoutCheck.subtitle, "Channel - 100 followers");
  assert.equal(layoutCheck.addDescText, "add a description");
  assert.equal(layoutCheck.addDescColor, layoutCheck.expectedPrimary);
  assert.ok(layoutCheck.headerRect.height > 0 && layoutCheck.composerRect.height > 0);
  assert.ok(
    layoutCheck.cardRect.left > layoutCheck.listRect.left &&
      layoutCheck.cardRect.right < layoutCheck.listRect.right,
  );
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

  // Verify no Grow menu item in ChatOptionsMenu or ChannelInfoScreen
  await page.getByRole("button", { name: "Channel options", exact: true }).click();
  assert.equal(await page.getByRole("menuitem", { name: /Grow/ }).count(), 0);
  await page.keyboard.press("Escape");

  // Card persists across reload & navigation while chat stays empty
  await page.reload();
  await card.waitFor();

  // Clicking empty description opens edit channel flow on ChannelInfoScreen
  await card.locator(".chat-growth-add-description").click();
  await page.waitForURL(`**/channels/${ownedEmptyChannelId}/info?edit=1`);
  await page.getByRole("dialog", { name: "Edit channel", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: "Edit channel", exact: true })
    .waitFor({ state: "detached" });
  assert.equal(await page.getByRole("button", { name: /Grow/ }).count(), 0);

  // Navigate back to channel -> card is still rendered!
  await goto(`/channels/${ownedEmptyChannelId}`);
  await card.waitFor();

  // Action 1: Share to my status -> prefilled StoryCreator text mode
  await card.locator('[data-slot="growth-share-status"]').click();
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

  // Action 2: Invite contacts -> copy link + channel-attributed send_channel_invitations (NO personal DM)
  await card.locator('[data-slot="growth-secondary-action"]').click();
  const inviteDialog = page.getByRole("dialog", { name: "Invite contacts", exact: true });
  await inviteDialog.waitFor();
  await inviteDialog.getByRole("button", { name: "Copy link", exact: true }).click();
  assert.equal(
    (await page.evaluate(() => window.__copiedTexts)).at(-1),
    `${baseUrl}/channels/${ownedEmptyChannelId}`,
  );
  await inviteDialog.getByRole("button", { name: /Sofia Reyes/ }).click();
  await inviteDialog.waitFor({ state: "detached" });
  assert.equal(insertedMessages.length, 0);
  assert.ok(
    sentChannelInvites.some(
      (x) => x.p_channel_id === ownedEmptyChannelId && x.p_invitations?.[0]?.recipient_id === sofia,
    ),
  );

  // Composer stays interactive with the card visible; optimistic local send hides card immediately!
  sendDelayMs = 400;
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("First channel post");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await card.waitFor({ state: "detached" });
  sendDelayMs = 0;
  await page.locator(".message-text", { hasText: "First channel post" }).waitFor();
  await page.reload();
  await page.locator(".message-text", { hasText: "First channel post" }).waitFor();
  assert.equal(await card.count(), 0);

  // 2. Spanish copy + singular follower + non-empty description
  await goto("/settings/appearance");
  const saveEs = page.waitForResponse(
    (r) => r.url().includes("/user_settings") && ["PATCH", "POST"].includes(r.request().method()),
  );
  await page.locator("#language").selectOption("es");
  await page.waitForFunction(() => document.documentElement.lang === "es");
  await saveEs;
  await goto(`/channels/${ownedEsChannelId}`);
  await card.waitFor();
  assert.equal(await card.locator(".chat-growth-title").textContent(), "Creaste 'Noticias Silver'");
  assert.equal(await card.locator(".chat-growth-subtitle").textContent(), "Canal - 1 seguidor");
  assert.equal(await card.locator(".chat-growth-description").textContent(), "Noticias diarias");
  assert.equal(
    await card.locator('[data-slot="growth-share-status"]').textContent(),
    "Compartir en mi estado",
  );
  assert.equal(
    await card.locator('[data-slot="growth-secondary-action"]').textContent(),
    "Invitar contactos",
  );

  // Switch back to EN
  await goto("/settings/appearance");
  const saveEn = page.waitForResponse(
    (r) => r.url().includes("/user_settings") && ["PATCH", "POST"].includes(r.request().method()),
  );
  await page.locator("#language").selectOption("en");
  await page.waitForFunction(() => document.documentElement.lang === "en");
  await saveEn;

  // 3. Regular follower & non-empty channel NEVER see the card
  await goto(`/channels/${followedEmptyChannelId}`);
  await page.locator('[data-slot="channel-created-pill"]').waitFor();
  await page.waitForTimeout(150);
  assert.equal(await card.count(), 0);

  await goto(`/channels/${ownedPopulatedChannelId}`);
  await page.getByText("Existing channel post", { exact: true }).waitFor();
  await page.waitForTimeout(150);
  assert.equal(await card.count(), 0);

  // 4. Group: creator empty WITH system event below card; edit description; Add members
  await goto(`/chats/${creatorEmptyGroupId}`);
  await card.waitFor();
  assert.equal(await card.getAttribute("data-chat-type"), "group");
  assert.equal(
    await card.locator(".chat-growth-title").textContent(),
    "You created 'Launch Group'",
  );
  assert.equal(await card.locator(".chat-growth-subtitle").textContent(), "Group - 3 members");
  const systemMsg = page.getByText("Alice added Sofia", { exact: true });
  await systemMsg.waitFor();
  const sysAfterCard = await page.evaluate(() => {
    const c = document.querySelector('[data-slot="chat-growth-card"]');
    const s = [...document.querySelectorAll(".system-pill")].find((el) =>
      el.textContent?.includes("Alice added Sofia"),
    );
    return Boolean(c && s && c.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  assert.equal(sysAfterCard, true);

  await card.locator(".chat-growth-add-description").click();
  await page.waitForURL(`**/chats/${creatorEmptyGroupId}/info?focus=description`);
  assert.ok(
    await page
      .getByRole("textbox", { name: "Description", exact: true })
      .evaluate((el) => el === document.activeElement),
  );
  assert.equal(await page.getByRole("button", { name: /Grow/ }).count(), 0);

  await goto(`/chats/${creatorEmptyGroupId}`);
  await card.waitFor();
  await card.locator('[data-slot="growth-secondary-action"]').click();
  const addMembersDlg = page.getByRole("dialog", { name: "Add members", exact: true });
  await addMembersDlg.waitFor();
  await addMembersDlg.getByRole("searchbox").fill("dave");
  await addMembersDlg.getByRole("checkbox").last().check();
  await addMembersDlg.getByRole("button", { name: "Add 1 members", exact: true }).click();
  await addMembersDlg.waitFor({ state: "detached" });
  assert.equal(addedMembersCalls.length, 1);

  // 5. Non-creator admin empty group: disappears immediately on realtime message from Sofia!
  await goto(`/chats/${adminEmptyGroupId}`);
  await card.waitFor();
  assert.equal(await card.locator(".chat-growth-title").textContent(), "You manage 'Admin Group'");
  assert.equal(await card.locator(".chat-growth-subtitle").textContent(), "Group - 2 members");

  const liveMsg = {
    id: uid(950),
    chat_id: adminEmptyGroupId,
    channel_id: null,
    sender_id: sofia,
    type: "text",
    content: "Hey team!",
    created_at: now(),
    deleted_at: null,
    deleted_for_everyone: false,
    is_pinned_in_chat: false,
    reply_to_message_id: null,
    reply_to_story_id: null,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    mentions: null,
  };
  messages.push(liveMsg);
  emitRealtimeInsert("messages", `chat_id=eq.${adminEmptyGroupId}`, liveMsg);
  await page.getByText("Hey team!", { exact: true }).waitFor();
  await card.waitFor({ state: "detached" });

  // Regular member & populated group NEVER see the card
  await goto(`/chats/${memberEmptyGroupId}`);
  await page.locator('[data-slot="composer-dock"]').waitFor();
  await page.waitForTimeout(150);
  assert.equal(await card.count(), 0);
  await page.getByRole("button", { name: "Chat options", exact: true }).click();
  assert.equal(await page.getByRole("menuitem", { name: /Grow/ }).count(), 0);
  await page.keyboard.press("Escape");

  await goto(`/chats/${populatedGroupId}`);
  await page.getByText("Existing group message", { exact: true }).waitFor();
  await page.waitForTimeout(150);
  assert.equal(await card.count(), 0);

  // 6. Community chat: creator empty vs regular member empty
  await goto(`/chats/${communityCreatorEmptyId}`);
  await card.waitFor();
  assert.equal(await card.getAttribute("data-chat-type"), "community_chat");
  assert.equal(await card.locator(".chat-growth-title").textContent(), "You created 'Town Square'");
  assert.equal(await card.locator(".chat-growth-subtitle").textContent(), "Community - 2 members");
  await card.locator('[data-slot="growth-secondary-action"]').click();
  await page.getByRole("dialog", { name: "Invite members", exact: true }).waitFor();
  await page.keyboard.press("Escape");

  await goto(`/chats/${communityMemberEmptyId}`);
  await page.locator('[data-slot="composer-dock"]').waitFor();
  await page.waitForTimeout(150);
  assert.equal(await card.count(), 0);

  // 7. Mobile viewport checks (390x844)
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await setupRoutes(mobileCtx);
  const mp = await mobileCtx.newPage();
  mp.setDefaultTimeout(10000);
  mp.on("pageerror", (e) => errors.push(e.stack ?? e.message));

  await mp.goto(`${baseUrl}/channels/${ownedEsChannelId}`);
  const mobileCard = mp.locator('[data-slot="chat-growth-card"]');
  await mobileCard.waitFor();
  const mobileBox = await mobileCard.boundingBox();
  assert.ok(mobileBox.x > 0 && mobileBox.x + mobileBox.width < 390);
  assert.equal(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  await mp.goto(`${baseUrl}/chats/${creatorEmptyGroupId}`);
  await mobileCard.waitFor();
  const mobileGroupBox = await mobileCard.boundingBox();
  assert.ok(mobileGroupBox.x > 0 && mobileGroupBox.x + mobileGroupBox.width < 390);
  assert.equal(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  assert.deepEqual(errors, []);
  console.log(
    "PASS: Inline ChatGrowthCard verified across channel, group, and community_chat (no dialog/backdrop/dismissal, persists across reload, disappears on optimistic send & realtime insert, system events below card, EN + ES, theme accent, desktop + mobile).",
  );
} catch (err) {
  console.error("Browser check failed:", errors, err);
  throw err;
} finally {
  await browser.close();
}
