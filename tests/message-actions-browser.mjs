// Real browser with mocked BFF, PostgREST, Storage and Phoenix boundaries.
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const uid = (n) => `${String(n).padStart(8, "0")}-2222-4222-8222-222222222222`;
const me = uid(1),
  other = uid(2),
  chatId = uid(100),
  groupId = uid(101),
  pendingId = uid(102),
  selfId = uid(103);
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
const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: me, aal: "aal2", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
const ago = (n) => new Date(Date.now() - n * 60000).toISOString();
const chat = (id = chatId, type = "direct") => ({
  id,
  type,
  name: type === "group" ? "Weekend people" : null,
  status: "active",
  avatar_url: null,
  community_id: null,
});
const member = (id = chatId, who = me) => ({
  chat_id: id,
  user_id: who,
  role: "member",
  joined_at: "2020-01-01T00:00:00Z",
  manually_unread: false,
});
const message = (n, patch = {}) => ({
  id: uid(1000 + n),
  chat_id: chatId,
  sender_id: n % 3 ? other : me,
  type: "text",
  content: `Message ${n}: A quiet afternoon, coffee and catching up.`,
  created_at: ago(200 - n),
  deleted_for_everyone: false,
  file_upload_id: null,
  media_thumbnail_upload_id: null,
  mentions: null,
  ...patch,
});
const rows = Array.from({ length: 80 }, (_, i) => message(i));
const own = message(900, {
  sender_id: me,
  created_at: ago(1),
  content: "My recent searchable message",
});
const incoming = message(901, {
  sender_id: other,
  created_at: ago(0.5),
  content: "Incoming searchable message",
});
rows.push(own, incoming);
let reactions = [],
  hidden = new Set(),
  failAction = false,
  failForwardResponse = false,
  forwardCalls = [];
const targets = Array.from({ length: 6 }, (_, i) => uid(200 + i));

const groupRows = [
  message(300, { chat_id: groupId, content: "Welcome to the weekend group", created_at: ago(10) }),
];
let receipts = rows
  .filter((m) => m.sender_id !== me)
  .map((m) => ({
    message_id: m.id,
    user_id: me,
    delivered_at: m.created_at,
    read_at: m.created_at,
  }));
let firstUnread = null,
  pageCalls = [],
  failSend = false,
  sendDelay = 0,
  uploads = [],
  uploadBytes = [],
  removed = [];
const slowUpload = false;
let accepted = false,
  removedMember = false;
const channels = new Map();
const response = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const errors = [];
async function setup(context) {
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
    const req = route.request(),
      url = new URL(req.url()),
      s = url.searchParams,
      p = url.pathname,
      method = req.method();
    const object = req.headers().accept?.includes("object");
    const result = (data) => response(route, object ? (data[0] ?? null) : data);
    if (p.endsWith("/user")) return response(route, user);
    if (p.endsWith("/profiles")) return response(route, profiles[0]);
    if (p.endsWith("/user_settings"))
      return response(route, {
        user_id: me,
        theme: "light",
        accent: "blue",
        language: "en",
        read_receipts_enabled: true,
      });
    if (p.endsWith("/profiles_visible"))
      return result(profiles.filter((x) => !s.get("id") || s.get("id").includes(x.id)));
    if (p.endsWith("/user_blocks") || p.endsWith("/profiles_blocked")) return result([]);
    if (p.endsWith("/chats")) {
      const id = s.get("id")?.slice(3);
      return result(
        (id === pendingId && !accepted) || removedMember
          ? []
          : [chat(id, id === groupId ? "group" : id === selfId ? "self" : "direct")],
      );
    }
    if (p.endsWith("/chat_members")) {
      if (s.get("select")?.includes("chat:chats"))
        return result(
          [chatId, ...targets].map((id, i) => ({
            ...member(id),
            archived_at: null,
            chat: {
              ...chat(id, "group"),
              name: i ? `Forward target ${i}` : "Current chat",
              last_message_id: own.id,
              last_message: own,
              last_message_at: ago(1),
              last_message_preview: own.content,
            },
          })),
        );
      const id = s.get("chat_id")?.slice(3) ?? chatId;
      return result(
        (id === pendingId && !accepted) || removedMember
          ? []
          : [member(id), ...(id === selfId ? [] : [member(id, other)])],
      );
    }
    if (p.endsWith("/chat_requests")) {
      const id = s.get("chat_id")?.slice(3);
      return result(
        id === pendingId && !accepted
          ? [
              {
                id: uid(500),
                chat_id: pendingId,
                sender_id: other,
                recipient_id: me,
                status: "pending",
              },
            ]
          : [],
      );
    }
    if (p.endsWith("/message_receipts")) {
      if (s.get("select")?.includes("message:messages"))
        return result(
          firstUnread
            ? [{ message_id: firstUnread, message: { chat_id: chatId, created_at: ago(180) } }]
            : [],
        );
      if (s.has("message_id"))
        return result(receipts.filter((r) => s.get("message_id").includes(r.message_id)));
      return result([]);
    }
    if (p.endsWith("/message_reactions")) return result(reactions);
    if (p.endsWith("/file_uploads")) {
      if (method === "POST") {
        const body = req.postDataJSON();
        const upload = { ...body, status: "pending" };
        uploads.push(upload);
        return result([upload]);
      }
      const id = s.get("id")?.slice(3);
      if (method === "PATCH") {
        const upload = uploads.find((u) => u.id === id);
        Object.assign(upload, req.postDataJSON());
        return result([upload]);
      }
      if (method === "DELETE") {
        removed.push(id);
        uploads = uploads.filter((u) => u.id !== id);
        return result([]);
      }
      return result(uploads.filter((u) => !s.get("id") || s.get("id").includes(u.id)));
    }
    if (method === "POST" && p.includes("/storage/v1/object/sign/"))
      return response(route, { signedURL: "/object/sign/chat-media/test.png?token=signed" });
    if (p.includes("/storage/v1/object/")) {
      if (method === "POST") {
        assert.equal(req.headers().authorization, `Bearer ${jwt}`);
        assert.equal(req.headers().apikey, "test-anon");
        if (slowUpload) await new Promise((resolve) => setTimeout(resolve, 1500));
        uploadBytes.push({
          size: req.postDataBuffer()?.length,
          type: req.headers()["content-type"],
        });
        return response(route, { Key: "uploaded" });
      }
      if (method === "DELETE") return response(route, []);
      return route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    }
    if (p.endsWith("/messages")) {
      if (method === "PATCH") {
        if (failAction) return response(route, { message: "Action rejected" }, 400);
        const row = rows.find((m) => m.id === s.get("id")?.slice(3));
        Object.assign(row, req.postDataJSON());
        return result([row]);
      }

      if (method === "POST") {
        const body = req.postDataJSON();
        if (sendDelay) await new Promise((r) => setTimeout(r, sendDelay));
        if (failSend) return response(route, { message: "Offline" }, 503);
        const data = message(400, { ...body, created_at: new Date().toISOString() });
        (body.chat_id === groupId ? groupRows : rows).push(data);
        return result([data]);
      }
      return result(
        [...rows, ...groupRows].filter(
          (m) =>
            !hidden.has(m.id) &&
            (!s.get("id") || s.get("id").includes(m.id)) &&
            (!s.get("chat_id") || s.get("chat_id").includes(m.chat_id)) &&
            (!s.has("is_pinned_in_chat") || m.is_pinned_in_chat) &&
            (!s.has("deleted_for_everyone") || !m.deleted_for_everyone),
        ),
      );
    }
    if (p.includes("/rpc/")) {
      const body = req.postDataJSON() ?? {};
      if (p.endsWith("/set_message_reaction")) {
        if (failAction) return response(route, { message: "Denied" }, 400);
        reactions = reactions.filter((r) => r.message_id !== body.p_message_id || r.user_id !== me);
        if (body.p_emoji)
          reactions.push({
            message_id: body.p_message_id,
            user_id: me,
            emoji: body.p_emoji,
            created_at: ago(0),
          });
        return response(route, null);
      }
      if (p.endsWith("/set_message_pin")) {
        const target = rows.find((m) => m.id === body.p_message_id);
        if (body.p_pin && rows.filter((m) => m.is_pinned_in_chat).length >= 3)
          return response(route, { message: "Cannot pin more than 3 messages in this chat" }, 400);
        target.is_pinned_in_chat = body.p_pin;
        return response(route, null);
      }
      if (p.endsWith("/delete_chat_message_for_me")) {
        hidden.add(body.p_message_id);
        return response(route, null);
      }
      if (p.endsWith("/forward_chat_message")) {
        forwardCalls.push(body);
        for (let i = 0; i < body.p_chat_ids.length; i++) {
          if (!rows.some((m) => m.id === body.p_message_ids[i]))
            rows.push({
              ...rows.find((m) => m.id === body.p_message_id),
              id: body.p_message_ids[i],
              chat_id: body.p_chat_ids[i],
              sender_id: me,
              forwarded_from_message_id: body.p_message_id,
              reply_to_message_id: null,
              mentions: null,
              created_at: ago(0),
            });
        }
        return response(
          route,
          failForwardResponse ? { message: "Response lost" } : null,
          failForwardResponse ? 503 : 200,
        );
      }
      if (p.endsWith("/get_chat_messages")) {
        pageCalls.push(body);
        const source =
          body.p_chat_id === groupId ? groupRows : body.p_chat_id === selfId ? [] : rows;
        const data = [...source]
          .filter((m) => !hidden.has(m.id) && m.chat_id === body.p_chat_id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
          .filter(
            (m) =>
              !body.p_before_at ||
              m.created_at < body.p_before_at ||
              (m.created_at === body.p_before_at && m.id < body.p_before_id),
          )
          .slice(0, 50);
        return response(route, data);
      }
      if (p.endsWith("/mark_chat_as_read")) {
        firstUnread = null;
        receipts = receipts.map((r) => ({ ...r, read_at: new Date().toISOString() }));
        return response(route, null);
      }
      if (p.endsWith("/own_upload_is_referenced")) return response(route, false);
      if (p.endsWith("/accept_chat_request")) {
        accepted = true;
        return response(route, null);
      }
      return response(route, null);
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
function emit(table, record, type = "INSERT") {
  for (const [topic, { socket, config }] of channels) {
    const ids = config.filter((c) => c.table === table).map((c) => c.id);
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
            table,
            type,
            columns: Object.keys(record).map((name) => ({ name, type: "text" })),
            record,
            old_record: {},
            errors: null,
            commit_timestamp: new Date().toISOString(),
          },
        },
      ]),
    );
  }
}
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  permissions: ["microphone", "clipboard-read", "clipboard-write"],
});
await setup(context);
const page = await context.newPage();
page.setDefaultTimeout(10000);
page.on("pageerror", (e) => errors.push(e.message));
const goto = async () => {
  await page.goto(`http://127.0.0.1:5173/chats/${chatId}`);
  await page.locator(".message-list").waitFor();
  await page.waitForTimeout(300);
};
const bubble = (id) => page.locator(`[data-message-id="${id}"]`);
const menu = async (id, action) => {
  await bubble(id).getByRole("button", { name: "Message actions", exact: true }).click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
};
const settle = () => page.waitForTimeout(300);
try {
  await goto();
  await bubble(own.id).locator(".message-bubble").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Copy text", exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), own.content);
  await menu(incoming.id, "Reply");
  await page.locator(".reply-bar").waitFor();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("A quoted response");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await settle();
  const reply = rows.find((m) => m.content === "A quoted response");
  assert.equal(reply.reply_to_message_id, incoming.id);
  await bubble(reply.id).locator(".message-reply button").click();
  await page.locator(".message-highlight").waitFor();
  assert.ok(await bubble(incoming.id).isVisible());
  await page.waitForTimeout(2100);
  assert.equal(await page.locator(".message-highlight").count(), 0);
  await menu(own.id, "Edit");
  await page.getByRole("dialog").getByRole("textbox").fill("Edited searchable text");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await settle();
  assert.equal(own.content, "Edited searchable text");
  assert.ok(await bubble(own.id).getByText("edited", { exact: true }).isVisible());
  failAction = true;
  await menu(own.id, "Edit");
  await page.getByRole("dialog").getByRole("textbox").fill("Rejected change");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Unable to save" }).waitFor();
  assert.ok(await bubble(own.id).getByText("Edited searchable text", { exact: true }).isVisible());
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  failAction = false;
  await menu(incoming.id, "React");
  await page.getByRole("button", { name: "👍", exact: true }).click();
  await settle();
  assert.equal(reactions.length, 1);
  assert.equal(reactions[0].emoji, "👍");
  await bubble(incoming.id).getByRole("button", { name: /👍 1/ }).click();
  await settle();
  assert.equal(reactions.length, 0);
  await menu(incoming.id, "React");
  await page.getByRole("button", { name: "❤️", exact: true }).click();
  await settle();
  await bubble(incoming.id).getByRole("button", { name: "Add reaction" }).click();
  await page.getByRole("button", { name: "🔥", exact: true }).click();
  await settle();
  assert.equal(reactions.length, 1);
  assert.equal(reactions[0].emoji, "🔥");
  reactions.push({ message_id: incoming.id, user_id: other, emoji: "🔥", created_at: ago(0) });
  emit("message_reactions", reactions.at(-1));
  await page.getByRole("button", { name: /🔥 2/ }).waitFor();
  await menu(own.id, "Pin");
  await page.getByRole("complementary", { name: "Pinned messages" }).waitFor();
  await menu(incoming.id, "Pin");
  await menu(reply.id, "Pin");
  await menu(rows[79].id, "Pin");
  await page.getByRole("status").filter({ hasText: "at most 3" }).waitFor();
  assert.equal(rows.filter((m) => m.is_pinned_in_chat).length, 3);
  await page.locator(".pinned-toggle").click();
  await page
    .getByRole("complementary")
    .getByRole("button", { name: "Go to message" })
    .first()
    .click();
  await page.locator(".message-highlight").waitFor();
  await page
    .getByRole("complementary")
    .getByRole("button", { name: "Unpin", exact: true })
    .first()
    .click();
  await settle();
  assert.equal(rows.filter((m) => m.is_pinned_in_chat).length, 2);
  await page.getByRole("button", { name: "Search messages", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search in conversation" }).fill("searchable");
  await settle();
  assert.equal(await page.locator('.in-chat-search [role="status"]').textContent(), "1/2");
  await page.getByRole("button", { name: "Next result" }).click();
  await settle();
  assert.equal(await page.locator('.in-chat-search [role="status"]').textContent(), "2/2");
  await page.getByRole("searchbox").press("Escape");
  assert.equal(await page.locator(".in-chat-search").count(), 0);
  await menu(incoming.id, "Forward");
  for (let i = 1; i <= 5; i++)
    await page.getByRole("checkbox", { name: `Forward target ${i}`, exact: true }).check();
  await page.getByRole("checkbox", { name: "Forward target 6", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "at most 5" }).waitFor();
  assert.equal(await page.getByRole("checkbox", { checked: true }).count(), 5);
  failForwardResponse = true;
  await page.getByRole("dialog").getByRole("button", { name: "Forward", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Forward failed" }).waitFor();
  failForwardResponse = false;
  await page.getByRole("dialog").getByRole("button", { name: "Forward", exact: true }).click();
  await settle();
  assert.equal(forwardCalls.length, 2);
  assert.deepEqual(forwardCalls[0].p_message_ids, forwardCalls[1].p_message_ids);
  assert.equal(rows.filter((m) => m.forwarded_from_message_id === incoming.id).length, 5);
  await menu(reply.id, "Delete for everyone");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete for everyone", exact: true })
    .click();
  await settle();
  assert.ok(
    await bubble(reply.id).getByText("This message was deleted", { exact: true }).isVisible(),
  );
  await menu(reply.id, "Delete for me");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete for me", exact: true })
    .click();
  await settle();
  assert.equal(await bubble(reply.id).count(), 0);
  // Actual Chromium microphone capture, encoding, decodeAudioData and peaks.
  await page.getByRole("button", { name: "Record voice note" }).click();
  await page.getByRole("button", { name: "Stop recording" }).waitFor();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page.getByRole("button", { name: "Send voice note" }).waitFor();
  await page.locator(".voice-recorder").getByRole("button", { name: "Play audio" }).click();
  await page.locator(".voice-recorder").getByRole("button", { name: "Pause audio" }).waitFor();
  await page.getByRole("button", { name: "Send voice note" }).click();
  await settle();
  const voice = rows.find((m) => m.type === "audio");
  assert.equal(voice.media_peaks.length, 40);
  assert.ok(voice.media_peaks.some((n) => n > 0));
  const upload = uploads.find((u) => u.id === voice.file_upload_id);
  assert.ok(upload.duration_seconds > 0 && upload.duration_seconds <= 300);
  assert.ok(Number.isInteger(upload.duration_seconds));
  assert.match(upload.mime_type, /audio\/webm/);
  assert.ok(uploadBytes.at(-1).size > 0);
  await page.getByRole("button", { name: "Record voice note" }).click();
  await page.getByRole("button", { name: "Stop recording" }).waitFor();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  assert.equal(await page.locator(".voice-recorder").count(), 0);
  // A cancelled permission request must not leave a late-arriving microphone alive.
  await page.evaluate(() => {
    window.__realGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = () =>
      new Promise((resolve) => {
        window.__resolveMic = resolve;
      });
  });
  await page.getByRole("button", { name: "Record voice note" }).click();
  await page.waitForFunction(() => !!window.__resolveMic);
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page.evaluate(async () => {
    window.__lateStream = await window.__realGUM({ audio: true });
    window.__resolveMic(window.__lateStream);
  });
  await page.waitForFunction(() =>
    window.__lateStream.getTracks().every((track) => track.readyState === "ended"),
  );
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await page.getByRole("button", { name: "Record voice note" }).click();
  await page.getByRole("alert").filter({ hasText: "Microphone access denied" }).waitFor();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = window.__realGUM;
  });
  await page.clock.install();
  await page.getByRole("button", { name: "Record voice note" }).click();
  await page.getByRole("button", { name: "Stop recording" }).waitFor();
  await page.waitForTimeout(500);
  await page.clock.fastForward(300001);
  await page.getByRole("button", { name: "Send voice note" }).waitFor();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page.clock.resume();
  await page.screenshot({ path: "/workspace/message-actions-desktop.png", fullPage: true });
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await setup(mobile);
  const mp = await mobile.newPage();
  mp.setDefaultTimeout(10000);
  await mp.goto(`http://127.0.0.1:5173/chats/${chatId}`);
  await mp.locator(".message-list").waitFor();
  await mp.waitForTimeout(300);
  const target = mp.locator(`[data-message-id="${incoming.id}"] .message-bubble`);
  await target.scrollIntoViewIfNeeded();
  await target.dispatchEvent("pointerdown", { pointerType: "touch", clientX: 100, clientY: 200 });
  await target.dispatchEvent("pointermove", { pointerType: "touch", clientX: 100, clientY: 225 });
  await mp.waitForTimeout(550);
  assert.equal(await mp.getByRole("menu").count(), 0);
  await target.dispatchEvent("pointerdown", { pointerType: "touch", clientX: 100, clientY: 200 });
  await mp.getByRole("menu").waitFor();
  await target.dispatchEvent("pointerup", { pointerType: "touch" });
  const bounds = await mp.getByRole("menu").boundingBox();
  assert.ok(bounds.width > 350);
  assert.equal(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mp.screenshot({ path: "/workspace/message-actions-mobile.png", fullPage: true });
  await mp.keyboard.press("Escape");
  await mp.getByRole("button", { name: "Record voice note" }).click();
  await mp.getByRole("button", { name: "Stop recording" }).waitFor();
  await mp
    .locator(".voice-recorder")
    .dispatchEvent("touchstart", { touches: [{ identifier: 1, clientX: 350, clientY: 700 }] });
  await mp
    .locator(".voice-recorder")
    .dispatchEvent("touchend", { changedTouches: [{ identifier: 1, clientX: 100, clientY: 700 }] });
  await mp.getByRole("button", { name: "Record voice note" }).waitFor();
  assert.equal(await mp.locator(".voice-recorder").count(), 0);
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: context menu/copy, reply and navigation, edit and rollback, reaction toggle/replacement/Realtime, three-pin limit, search, forwarding cap and idempotent retries, deletion/tombstones, real voice recording/upload, discard/late permission/denial/five-minute stop, mobile long press/scroll cancellation/slide-to-cancel/layout.",
  );
} catch (error) {
  await page.screenshot({ path: "/workspace/message-actions-failure.png", fullPage: true });
  throw error;
} finally {
  await browser.close();
}
