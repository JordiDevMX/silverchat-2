// Real Chromium browser test for offline message outbox persistence, UI state, and auto-send on reconnect.
import assert from "node:assert/strict";
import { launchBrowser } from "./lib/browser.mjs";

const baseUrl = process.env.UI_BASE_URL ?? process.env.TEST_BASE_URL ?? "http://127.0.0.1:5173";
const browser = await launchBrowser({ args: ["--no-sandbox"] });
const uid = (n) => `${String(n).padStart(8, "0")}-3333-4333-8333-333333333333`;
const me = uid(1);
const other = uid(2);
const chatId = uid(100);
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
];
const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(
  JSON.stringify({ sub: me, aal: "aal2", exp: Math.floor(Date.now() / 1000) + 3600 }),
).toString("base64url")}.signature`;

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
const rows = [
  {
    id: uid(1000),
    chat_id: chatId,
    sender_id: other,
    type: "text",
    content: "Hey, let me know when you arrive.",
    created_at: ago(5),
    deleted_for_everyone: false,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    mentions: null,
  },
];
const postedMessages = [];

const response = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function setup(context) {
  await context.route("https://cdn.jsdelivr.net/npm/emojibase-data@*/**", (r) => r.abort());
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
    if (p.endsWith("/user_settings")) {
      return response(route, {
        user_id: me,
        theme: "light",
        accent: "blue",
        language: "en",
        read_receipts_enabled: true,
      });
    }
    if (p.endsWith("/profiles_visible")) {
      return result(profiles.filter((x) => !s.get("id") || s.get("id").includes(x.id)));
    }
    if (p.endsWith("/user_blocks") || p.endsWith("/profiles_blocked")) return result([]);
    if (p.endsWith("/chats")) {
      return result([
        {
          id: chatId,
          type: "direct",
          name: null,
          direct_pair_key: `${me}::${other}`,
          status: "active",
          avatar_url: null,
          community_id: null,
        },
      ]);
    }
    if (p.endsWith("/chat_members")) {
      if (s.get("select")?.includes("chat:chats")) {
        const last = rows.at(-1);
        return result([
          {
            chat_id: chatId,
            user_id: me,
            role: "member",
            joined_at: "2020-01-01T00:00:00Z",
            last_read_at: ago(1),
            pinned_at: null,
            favorited_at: null,
            archived_at: null,
            muted_until: null,
            manually_unread: false,
            chat: {
              id: chatId,
              type: "direct",
              status: "active",
              community_id: null,
              name: null,
              avatar_url: null,
              direct_pair_key: `${me}::${other}`,
              last_message_at: last?.created_at ?? null,
              last_message_preview: last?.content ?? null,
              last_message_id: last?.id ?? null,
              last_message: last
                ? {
                    id: last.id,
                    sender_id: last.sender_id,
                    type: last.type,
                    deleted_for_everyone: false,
                  }
                : null,
            },
          },
        ]);
      }
      return result([
        {
          chat_id: chatId,
          user_id: me,
          role: "member",
          joined_at: "2020-01-01T00:00:00Z",
          manually_unread: false,
        },
        {
          chat_id: chatId,
          user_id: other,
          role: "member",
          joined_at: "2020-01-01T00:00:00Z",
          manually_unread: false,
        },
      ]);
    }
    if (p.endsWith("/chat_requests")) return result([]);
    if (p.endsWith("/message_receipts")) return result([]);
    if (p.endsWith("/message_reactions")) return result([]);
    if (p.endsWith("/messages")) {
      if (s.has("is_pinned_in_chat")) return result([]);
      if (method === "POST") {
        const body = req.postDataJSON();
        const saved = {
          ...body,
          created_at: new Date().toISOString(),
          deleted_for_everyone: false,
          file_upload_id: null,
          media_thumbnail_upload_id: null,
          mentions: body.mentions ?? null,
        };
        postedMessages.push(saved);
        rows.push(saved);
        return result([saved]);
      }
      return result(rows.filter((m) => !s.get("id") || s.get("id").includes(m.id)));
    }
    if (p.endsWith("/rpc/get_chat_messages")) {
      const data = [...rows].sort(
        (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
      );
      return response(route, data);
    }
    if (p.endsWith("/rpc/mark_chat_as_read")) return response(route, null);
    return result([]);
  });
  await context.routeWebSocket("**/realtime/v1/websocket**", (socket) =>
    socket.onMessage((raw) => {
      const [join, ref, topic, event, payload] = JSON.parse(String(raw));
      if (event === "phx_join") {
        const config = (payload.config.postgres_changes ?? []).map((c, i) => ({ ...c, id: i + 1 }));
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

const errors = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await setup(context);
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));

try {
  // 1. Open chat online so chat details and messages are loaded.
  await page.goto(`${baseUrl}/chats/${chatId}`);
  await page.locator(".message-list").waitFor();
  await page.locator(".message-list").getByText("Hey, let me know when you arrive.").waitFor();

  // 2. Go offline and send a message.
  await context.setOffline(true);
  const textbox = page.getByRole("textbox", { name: "Message", exact: true });
  await textbox.fill("Offline first");
  await page.getByRole("button", { name: "Send message", exact: true }).click();

  // Bubble must immediately appear with Sending state and spinning icon; composer must be empty without error.
  const firstBubble = page.locator("[data-message-id]").filter({ hasText: "Offline first" });
  await firstBubble.waitFor();
  await firstBubble.getByRole("img", { name: "Sending", exact: true }).waitFor();
  const spinStyle = await firstBubble.locator(".message-status .spin").evaluate((el) => {
    const s = getComputedStyle(el);
    return { animationName: s.animationName, iterationCount: s.animationIterationCount };
  });
  assert.notEqual(spinStyle.animationName, "none", "In-chat Sending spinner must animate");
  assert.equal(spinStyle.iterationCount, "infinite");
  assert.equal(await textbox.inputValue(), "");
  assert.equal(await page.locator(".composer-error").count(), 0);
  assert.equal(postedMessages.length, 0);

  // 3. Navigate back to ChatList; must show pending (spinner), NOT Draft.
  await page.getByRole("link", { name: "Chats", exact: true }).first().click();
  const chatRow = page.locator(`.chat-list-item[data-chat-id="${chatId}"]`);
  await chatRow.waitFor();
  await chatRow.locator(".preview-pending .chat-spin").waitFor();
  assert.equal(await chatRow.locator(".preview-text").textContent(), "Offline first");
  assert.equal(await chatRow.locator(".draft-pill").count(), 0);

  // 4. Re-enter chat while still offline; input must be empty (NOT treated as a draft), bubble still Sending.
  await chatRow.locator(".chat-row-main").click();
  await page.locator(".message-list").waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Message", exact: true }).inputValue(),
    "",
    "Pending offline message must not return to the composer as a draft",
  );
  await page
    .locator("[data-message-id]")
    .filter({ hasText: "Offline first" })
    .getByRole("img", { name: "Sending", exact: true })
    .waitFor();

  // Send a second message while still offline.
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Offline second");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page
    .locator("[data-message-id]")
    .filter({ hasText: "Offline second" })
    .getByRole("img", { name: "Sending", exact: true })
    .waitFor();

  // 5. Return to ChatList again; still pending, never Draft, and persisted in outbox storage.
  await page.getByRole("link", { name: "Chats", exact: true }).first().click();
  await chatRow.locator(".preview-pending .chat-spin").waitFor();
  assert.equal(await chatRow.locator(".preview-text").textContent(), "Offline second");
  assert.equal(await chatRow.locator(".draft-pill").count(), 0);

  const storageState = await page.evaluate(
    ({ userId, cId }) => ({
      draft: localStorage.getItem(`silverchat_draft_${cId}`),
      outbox: JSON.parse(localStorage.getItem(`silverchat_outbox_${userId}`) ?? "[]"),
    }),
    { userId: me, cId: chatId },
  );
  assert.equal(storageState.draft, null);
  assert.deepEqual(
    storageState.outbox.map((m) => m.input.content),
    ["Offline first", "Offline second"],
  );

  // 6. Reconnect while sitting on ChatList; outbox must automatically send both messages in FIFO order.
  await context.setOffline(false);
  await page.waitForFunction((userId) => !localStorage.getItem(`silverchat_outbox_${userId}`), me, {
    timeout: 10000,
  });
  assert.deepEqual(
    postedMessages.map((m) => m.content),
    ["Offline first", "Offline second"],
  );
  await chatRow.locator(".preview-message").waitFor();
  assert.equal(await chatRow.locator(".preview-text").textContent(), "You: Offline second");

  // Re-enter chat and verify both messages are persisted as real sent messages.
  await chatRow.locator(".chat-row-main").click();
  await page.locator(`[data-message-id="${postedMessages[0].id}"]`).waitFor();
  await page.locator(`[data-message-id="${postedMessages[1].id}"]`).waitFor();
  assert.equal(await page.locator('[aria-label="Sending"]').count(), 0);

  // 7. Browser restart / reload recovery: seed a pending outbox item as if saved before closing, reload online -> auto-sends.
  const persistedClientId = uid(999);
  await page.evaluate(
    ({ userId, cId, clientId }) => {
      localStorage.setItem(
        `silverchat_outbox_${userId}`,
        JSON.stringify([
          {
            clientId,
            userId,
            chatId: cId,
            channelMode: false,
            createdAt: new Date().toISOString(),
            status: "pending",
            input: { type: "text", content: "Survived reload" },
          },
        ]),
      );
    },
    { userId: me, cId: chatId, clientId: persistedClientId },
  );
  await page.reload();
  await page.locator(`[data-message-id="${persistedClientId}"]`).waitFor({ timeout: 10000 });
  assert.equal(postedMessages.at(-1).content, "Survived reload");

  // 8. Legacy draft with pending/failed flag must never be restored into the composer input.
  await page.evaluate(
    ({ userId, cId }) => {
      localStorage.setItem(
        `silverchat_draft_${cId}`,
        JSON.stringify({
          text: "Legacy pending draft",
          mediaUrls: [],
          replyToId: null,
          updatedAt: new Date().toISOString(),
          ownerId: userId,
          pending: true,
        }),
      );
    },
    { userId: me, cId: chatId },
  );
  await page.reload();
  await page.locator(".message-list").waitFor();
  assert.equal(await page.getByRole("textbox", { name: "Message", exact: true }).inputValue(), "");

  // 9. Mobile viewport back-navigation flow while offline.
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await setup(mobile);
  const mp = await mobile.newPage();
  mp.on("pageerror", (e) => errors.push(e.message));
  await mp.goto(`${baseUrl}/chats/${chatId}`);
  await mp.locator(".message-list").waitFor();
  await mobile.setOffline(true);
  await mp.getByRole("textbox", { name: "Message", exact: true }).fill("Mobile offline");
  await mp.getByRole("button", { name: "Send message", exact: true }).click();
  await mp
    .locator("[data-message-id]")
    .filter({ hasText: "Mobile offline" })
    .getByRole("img", { name: "Sending", exact: true })
    .waitFor();
  await mp.getByRole("link", { name: "Back to chats", exact: true }).click();
  const mobileRow = mp.locator(`.chat-list-item[data-chat-id="${chatId}"]`);
  await mobileRow.locator(".preview-pending .chat-spin").waitFor();
  assert.equal(await mobileRow.locator(".draft-pill").count(), 0);
  await mobileRow.locator(".chat-row-main").click();
  await mp.locator(".message-list").waitFor();
  assert.equal(await mp.getByRole("textbox", { name: "Message", exact: true }).inputValue(), "");
  await mp
    .locator("[data-message-id]")
    .filter({ hasText: "Mobile offline" })
    .getByRole("img", { name: "Sending", exact: true })
    .waitFor();
  await mp.getByRole("link", { name: "Back to chats", exact: true }).click();
  await mobileRow.locator(".preview-pending .chat-spin").waitFor();
  await mobile.setOffline(false);
  await mp.waitForFunction((userId) => !localStorage.getItem(`silverchat_outbox_${userId}`), me, {
    timeout: 10000,
  });
  assert.equal(postedMessages.at(-1).content, "Mobile offline");
  await mobile.close();

  assert.deepEqual(errors, []);
  console.log(
    "PASS: offline outbox shows Sending bubble immediately, never turns into draft on navigation, persists in localStorage, and auto-sends FIFO on reconnect/reload.",
  );
} finally {
  await browser.close();
}
