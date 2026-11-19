// End-to-end Chromium validation for emoji reaction notifications across two users.
import assert from "node:assert/strict";
import { launchBrowser } from "./lib/browser.mjs";

const baseUrl =
  process.env.TEST_BASE_URL ??
  process.env.UI_BASE_URL ??
  process.env.TEST_ORIGIN ??
  "http://127.0.0.1:5175";

const browser = await launchBrowser({ args: ["--no-sandbox"] });
const uid = (n) => `${String(n).padStart(8, "0")}-2222-4222-8222-222222222222`;
const userA = uid(1),
  userB = uid(2),
  userC = uid(3),
  userD = uid(4),
  userE = uid(5),
  chatId = uid(100),
  mutedChatId = uid(101),
  archivedChatId = uid(102);

const authUser = {
  id: userA,
  email: "alice@example.test",
  aud: "authenticated",
  role: "authenticated",
  user_metadata: {},
  app_metadata: {},
  factors: [],
};

const profiles = [
  {
    id: userA,
    username: "alice",
    display_name: "Alice Rivera",
    avatar_url: null,
    scheduled_deletion_at: null,
  },
  {
    id: userB,
    username: "sofia",
    display_name: "Sofia Reyes",
    avatar_url: null,
    last_seen_at: new Date().toISOString(),
  },
  { id: userC, username: "mateo", display_name: "Mateo Cruz", avatar_url: null },
  { id: userD, username: "nora", display_name: "Nora Bennett", avatar_url: null },
  { id: userE, username: "leo", display_name: "Leo Park", avatar_url: null },
];

const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(
  JSON.stringify({ sub: userA, aal: "aal2", exp: Math.floor(Date.now() / 1000) + 3600 }),
).toString("base64url")}.signature`;

const ago = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();

const makeMessage = (n, patch = {}) => ({
  id: uid(1000 + n),
  chat_id: chatId,
  channel_id: null,
  sender_id: n % 2 === 0 ? userA : userB,
  type: "text",
  content: `Message ${n}: A quiet afternoon.`,
  created_at: ago(200 - n),
  deleted_for_everyone: false,
  file_upload_id: null,
  media_thumbnail_upload_id: null,
  mentions: null,
  ...patch,
});

const messages = Array.from({ length: 70 }, (_, i) => makeMessage(i));
const authorMsg = makeMessage(900, {
  sender_id: userA,
  created_at: ago(5),
  content: "Coffee at 4pm?",
});
const mutedAuthorMsg = makeMessage(901, {
  chat_id: mutedChatId,
  sender_id: userA,
  created_at: ago(4),
  content: "Muted thread message",
});
const archivedAuthorMsg = makeMessage(902, {
  chat_id: archivedChatId,
  sender_id: userA,
  created_at: ago(3),
  content: "Archived thread message",
});
messages.push(authorMsg, mutedAuthorMsg, archivedAuthorMsg);

const lastReadByChat = new Map([
  [chatId, ago(2)],
  [mutedChatId, ago(2)],
  [archivedChatId, ago(2)],
]);

let reactions = [];
const markReadCalls = [];
const channels = new Map();
const errors = [];

const fulfill = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

function buildMemberships() {
  return [
    {
      chat_id: chatId,
      user_id: userA,
      role: "member",
      joined_at: ago(500),
      last_read_at: lastReadByChat.get(chatId),
      pinned_at: null,
      favorited_at: null,
      archived_at: null,
      muted_until: null,
      manually_unread: false,
      chat: {
        id: chatId,
        type: "group",
        status: "active",
        community_id: null,
        name: "Design Team",
        avatar_url: null,
        direct_pair_key: null,
        last_message_at: authorMsg.created_at,
        last_message_preview: authorMsg.content,
        last_message_id: authorMsg.id,
        last_message: {
          id: authorMsg.id,
          sender_id: userA,
          type: "text",
          deleted_for_everyone: false,
        },
      },
    },
    {
      chat_id: mutedChatId,
      user_id: userA,
      role: "member",
      joined_at: ago(500),
      last_read_at: lastReadByChat.get(mutedChatId),
      pinned_at: null,
      favorited_at: null,
      archived_at: null,
      muted_until: "9999-12-31T00:00:00Z",
      manually_unread: false,
      chat: {
        id: mutedChatId,
        type: "direct",
        status: "active",
        community_id: null,
        name: null,
        avatar_url: null,
        direct_pair_key: `${userA}::${userC}`,
        last_message_at: mutedAuthorMsg.created_at,
        last_message_preview: mutedAuthorMsg.content,
        last_message_id: mutedAuthorMsg.id,
        last_message: {
          id: mutedAuthorMsg.id,
          sender_id: userA,
          type: "text",
          deleted_for_everyone: false,
        },
      },
    },
    {
      chat_id: archivedChatId,
      user_id: userA,
      role: "member",
      joined_at: ago(500),
      last_read_at: lastReadByChat.get(archivedChatId),
      pinned_at: null,
      favorited_at: null,
      archived_at: ago(1),
      muted_until: null,
      manually_unread: false,
      chat: {
        id: archivedChatId,
        type: "direct",
        status: "active",
        community_id: null,
        name: null,
        avatar_url: null,
        direct_pair_key: `${userA}::${userD}`,
        last_message_at: archivedAuthorMsg.created_at,
        last_message_preview: archivedAuthorMsg.content,
        last_message_id: archivedAuthorMsg.id,
        last_message: {
          id: archivedAuthorMsg.id,
          sender_id: userA,
          type: "text",
          deleted_for_everyone: false,
        },
      },
    },
  ];
}

async function setup(context) {
  await context.route("https://cdn.jsdelivr.net/npm/emojibase-data@*/**", (route) => route.abort());
  await context.route("**/api/auth/**", (r) =>
    fulfill(r, {
      accessToken: jwt,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      user: authUser,
      aal: "aal2",
      mfaRequired: false,
    }),
  );
  await context.route("https://supabase.test/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      s = url.searchParams,
      p = url.pathname;
    const object = req.headers().accept?.includes("object");
    const result = (data) => fulfill(route, object ? (data[0] ?? null) : data);

    if (p.endsWith("/user")) return fulfill(route, authUser);
    if (p.endsWith("/profiles")) return fulfill(route, profiles[0]);
    if (p.endsWith("/user_settings"))
      return fulfill(route, {
        user_id: userA,
        theme: "light",
        accent: "blue",
        language: "en",
        read_receipts_enabled: true,
        notifications_enabled: true,
        notification_sound_enabled: false,
        notification_previews_enabled: true,
      });
    if (p.endsWith("/profiles_visible"))
      return result(profiles.filter((x) => !s.get("id") || s.get("id").includes(x.id)));
    if (p.endsWith("/user_blocks") || p.endsWith("/profiles_blocked")) return result([]);
    if (p.endsWith("/chats")) {
      const id = s.get("id")?.replace("eq.", "");
      const m = buildMemberships().find((item) => item.chat_id === id);
      return result(m ? [m.chat] : []);
    }
    if (p.endsWith("/chat_members")) {
      if (s.get("select")?.includes("chat:chats")) return result(buildMemberships());
      const cid = s.get("chat_id")?.replace("eq.", "") ?? chatId;
      return result([
        {
          chat_id: cid,
          user_id: userA,
          role: "member",
          joined_at: ago(500),
          last_read_at: lastReadByChat.get(cid),
          manually_unread: false,
        },
        {
          chat_id: cid,
          user_id: userB,
          role: "member",
          joined_at: ago(500),
          manually_unread: false,
        },
        {
          chat_id: cid,
          user_id: userC,
          role: "member",
          joined_at: ago(500),
          manually_unread: false,
        },
        {
          chat_id: cid,
          user_id: userD,
          role: "member",
          joined_at: ago(500),
          manually_unread: false,
        },
        {
          chat_id: cid,
          user_id: userE,
          role: "member",
          joined_at: ago(500),
          manually_unread: false,
        },
      ]);
    }
    if (
      p.endsWith("/chat_requests") ||
      p.endsWith("/message_receipts") ||
      p.endsWith("/message_deletions")
    )
      return result([]);
    if (p.endsWith("/message_reactions")) {
      const withMessage = s.get("select")?.includes("message:messages");
      const rows = reactions.flatMap((r) => {
        if (s.get("message_id") && !s.get("message_id").includes(r.message_id)) return [];
        const msg = messages.find((m) => m.id === r.message_id);
        if (withMessage) {
          if (!msg || msg.sender_id !== userA || r.user_id === userA) return [];
          return [{ ...r, message: msg }];
        }
        return [r];
      });
      return result(rows);
    }
    if (p.endsWith("/messages")) {
      const idFilter = s.get("id");
      return result(
        messages.filter(
          (m) =>
            (!idFilter || idFilter.includes(m.id)) &&
            (!s.get("chat_id") || s.get("chat_id").includes(m.chat_id)) &&
            (!s.has("is_pinned_in_chat") || m.is_pinned_in_chat),
        ),
      );
    }
    if (p.includes("/rpc/")) {
      const body = req.postDataJSON() ?? {};
      if (p.endsWith("/set_message_reaction")) {
        reactions = reactions.filter(
          (r) => !(r.message_id === body.p_message_id && r.user_id === userA),
        );
        if (body.p_emoji) {
          reactions.push({
            message_id: body.p_message_id,
            user_id: userA,
            emoji: body.p_emoji,
            created_at: new Date().toISOString(),
          });
        }
        return fulfill(route, null);
      }
      if (p.endsWith("/get_chat_messages")) {
        const data = [...messages]
          .filter((m) => m.chat_id === body.p_chat_id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
          .filter(
            (m) =>
              !body.p_before_at ||
              m.created_at < body.p_before_at ||
              (m.created_at === body.p_before_at && m.id < body.p_before_id),
          )
          .slice(0, 50);
        return fulfill(route, data);
      }
      if (p.endsWith("/mark_chat_as_read")) {
        markReadCalls.push(body.p_chat_id);
        lastReadByChat.set(body.p_chat_id, new Date().toISOString());
        return fulfill(route, null);
      }
      return fulfill(route, null);
    }
    return result([]);
  });

  await context.routeWebSocket("**/realtime/v1/websocket**", (socket) =>
    socket.onMessage((raw) => {
      const [join, ref, topic, event, payload] = JSON.parse(String(raw));
      if (event === "phx_join") {
        const config = (payload.config.postgres_changes ?? []).map((c, i) => ({ ...c, id: i + 1 }));
        channels.set(topic, { socket, config });
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
      if (event === "heartbeat")
        socket.send(
          JSON.stringify([join, ref, topic, "phx_reply", { status: "ok", response: {} }]),
        );
    }),
  );
}

function emitReaction(type, record, oldRecord = {}) {
  for (const [topic, { socket, config }] of channels) {
    const ids = config.filter((c) => c.table === "message_reactions").map((c) => c.id);
    if (!ids.length) continue;
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
            table: "message_reactions",
            type,
            columns: Object.keys(record.message_id ? record : oldRecord).map((name) => ({
              name,
              type: "text",
            })),
            record,
            old_record: oldRecord,
            errors: null,
            commit_timestamp: new Date().toISOString(),
          },
        },
      ]),
    );
  }
}

function userReact(reactorId, messageId, emoji, timestamp = new Date().toISOString()) {
  const existing = reactions.find((r) => r.message_id === messageId && r.user_id === reactorId);
  reactions = reactions.filter((r) => !(r.message_id === messageId && r.user_id === reactorId));
  if (emoji === null) {
    emitReaction("DELETE", {}, { message_id: messageId, user_id: reactorId });
    return;
  }
  const row = { message_id: messageId, user_id: reactorId, emoji, created_at: timestamp };
  reactions.push(row);
  emitReaction(
    existing ? "UPDATE" : "INSERT",
    row,
    existing ? { message_id: messageId, user_id: reactorId } : {},
  );
}

const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await setup(context);
const page = await context.newPage();
page.setDefaultTimeout(10000);
page.on("pageerror", (e) => errors.push(e.message));

try {
  // 1. Author inside the chat: self-reaction and incoming reaction update chips live without toast spam.
  await page.goto(`${baseUrl}/chats/${chatId}`);
  await page.locator(".message-list").waitFor();
  await page.waitForTimeout(250);

  // Self-reaction via realtime echo -> no toast
  userReact(userA, authorMsg.id, "👍");
  await page.waitForTimeout(250);
  assert.equal(
    await page.locator(".chat-settings-notice").count(),
    0,
    "Self-reaction must not notify",
  );
  userReact(userA, authorMsg.id, null);

  // User B reacts while User A is actively viewing the chat -> reaction chip updates, no toast
  userReact(userB, authorMsg.id, "👍");
  await page
    .locator(`[data-message-id="${authorMsg.id}"]`)
    .getByRole("button", { name: /👍 1/ })
    .waitFor();
  assert.equal(
    await page.locator(".chat-settings-notice").count(),
    0,
    "Author actively inside chat must not get toast spam",
  );
  userReact(userB, authorMsg.id, null);
  await page.waitForTimeout(200);

  // 2. Author outside the chat (on /chats): react, duplicate, swap, multi-reactor aggregation, withdrawal.
  await page.goto(`${baseUrl}/chats`);
  const chatRow = page.locator(`[data-chat-id="${chatId}"]`);
  await chatRow.waitFor();
  await page.waitForTimeout(250);

  let tick = Date.now();
  const nextIso = () => {
    tick += 10;
    return new Date(tick).toISOString();
  };

  const t1 = nextIso();
  userReact(userB, authorMsg.id, "👍", t1);

  const toast = page.locator(".chat-settings-notice");
  await toast.getByText('Sofia Reyes reacted 👍 to "Coffee at 4pm?"').waitFor();
  assert.equal(await toast.getAttribute("aria-live"), "polite");
  await chatRow.getByText('Sofia Reyes reacted 👍 to "Coffee at 4pm?"').waitFor();
  assert.equal(await chatRow.locator(".chat-badge").textContent(), "1");

  // Idempotent duplicate delivery does not inflate badge count
  emitReaction("INSERT", { message_id: authorMsg.id, user_id: userB, emoji: "👍", created_at: t1 });
  await page.waitForTimeout(200);
  assert.equal(await chatRow.locator(".chat-badge").textContent(), "1");

  // Reaction swapped (👍 -> ❤️): updates in place without duplicate entry
  userReact(userB, authorMsg.id, "❤️", nextIso());
  await toast.getByText('Sofia Reyes reacted ❤️ to "Coffee at 4pm?"').waitFor();
  await chatRow.getByText('Sofia Reyes reacted ❤️ to "Coffee at 4pm?"').waitFor();
  assert.equal(await chatRow.locator(".chat-badge").textContent(), "1");

  // Multiple reactors -> aggregation ("Leo Park and 3 others reacted ❤️")
  userReact(userC, authorMsg.id, "❤️", nextIso());
  userReact(userD, authorMsg.id, "❤️", nextIso());
  userReact(userE, authorMsg.id, "❤️", nextIso());
  await toast.getByText("Leo Park and 3 others reacted ❤️").waitFor();
  await chatRow.getByText("Leo Park and 3 others reacted ❤️").waitFor();
  assert.equal(await chatRow.locator(".chat-badge").textContent(), "4");

  // Partial withdrawal -> recomputes aggregation; full withdrawal -> dismisses toast & restores chat row
  userReact(userE, authorMsg.id, null);
  userReact(userD, authorMsg.id, null);
  userReact(userC, authorMsg.id, null);
  await toast.getByText('Sofia Reyes reacted ❤️ to "Coffee at 4pm?"').waitFor();
  assert.equal(await chatRow.locator(".chat-badge").textContent(), "1");

  userReact(userB, authorMsg.id, null);
  await toast.waitFor({ state: "hidden" });
  assert.equal(await chatRow.locator(".chat-badge").count(), 0);
  await chatRow.getByText("You: Coffee at 4pm?").waitFor();

  // 3. Muted and archived chats do not trigger toast or unread badges
  userReact(userC, mutedAuthorMsg.id, "🔥", nextIso());
  userReact(userD, archivedAuthorMsg.id, "🔥", nextIso());
  await page.waitForTimeout(300);
  assert.equal(await toast.count(), 0, "Muted/archived chats must not pop toast");
  const mutedRow = page.locator(`[data-chat-id="${mutedChatId}"]`);
  assert.equal(await mutedRow.locator(".chat-badge").count(), 0, "Muted chat hides unread badge");

  // 4. Persistence across reload + clicking toast deep-links and scrolls to older reacted message
  const olderAuthorMsg = messages[6]; // sender_id === userA (index 6 is even), older page
  const tPersist = nextIso();
  userReact(userB, olderAuthorMsg.id, "🎉", tPersist);
  await toast.getByText(/Sofia Reyes reacted 🎉/).waitFor();

  // Reload page to verify persisted DB state survives full reload
  await page.reload();
  await chatRow.waitFor();
  await chatRow.getByText(/Sofia Reyes reacted 🎉/).waitFor();
  assert.equal(await chatRow.locator(".chat-badge").textContent(), "1");

  // Trigger a reaction while on /settings/notifications and click toast to deep-link & scroll
  await page.goto(`${baseUrl}/settings/notifications`);
  await page.getByRole("heading", { name: "Notifications" }).waitFor();
  await page.waitForTimeout(250);
  userReact(userC, olderAuthorMsg.id, "🎉", nextIso());
  await toast.getByText("Mateo Cruz and Sofia Reyes reacted 🎉").waitFor();

  await toast.locator(".chat-notice-link").click();
  await page.waitForURL(
    (url) =>
      url.pathname === `/chats/${chatId}` && url.searchParams.get("scrollTo") === olderAuthorMsg.id,
  );
  const targetBubble = page.locator(`[data-message-id="${olderAuthorMsg.id}"]`);
  await targetBubble.waitFor();
  await page.locator(".message-highlight").waitFor();
  const targetBox = await targetBubble.boundingBox();
  const listBox = await page.locator(".message-list").boundingBox();
  assert.ok(
    targetBox &&
      listBox &&
      targetBox.y >= listBox.y - 20 &&
      targetBox.y < listBox.y + listBox.height,
    "Clicking notification scrolls older reacted message into viewport",
  );

  // Read state persists after viewing the deep-linked reacted message
  await page.waitForFunction(() => true);
  await page.waitForTimeout(1200);
  assert.ok(markReadCalls.includes(chatId), "Opening reacted message marks chat reactions read");

  await page.goto(`${baseUrl}/chats`);
  await chatRow.waitFor();
  assert.equal(await chatRow.locator(".chat-badge").count(), 0, "Unread badge cleared after read");
  assert.deepEqual(errors, []);
  console.log("PASS reaction notifications end-to-end browser verification");
} finally {
  await browser.close();
}
