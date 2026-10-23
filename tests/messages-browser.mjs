// Real browser with mocked BFF, PostgREST, Storage and Phoenix boundaries.
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
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
  readCalls = 0,
  pageCalls = [],
  failSend = false,
  sendDelay = 0,
  uploads = [],
  uploadBytes = [],
  removed = [];
let slowUpload = false;
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
        return result([
          {
            ...member(),
            chat: {
              ...chat(),
              last_message_id: rows.at(-1)?.id,
              last_message: rows.at(-1),
              last_message_at: ago(1),
              last_message_preview: "See you soon",
            },
          },
        ]);
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
    if (p.endsWith("/message_reactions")) return result([]);
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
      if (s.has("is_pinned_in_chat")) return result([]);
      if (method === "POST") {
        const body = req.postDataJSON();
        if (sendDelay) await new Promise((r) => setTimeout(r, sendDelay));
        if (failSend) return response(route, { message: "Offline" }, 503);
        const data = message(400, { ...body, created_at: new Date().toISOString() });
        (body.chat_id === groupId ? groupRows : rows).push(data);
        return result([data]);
      }
      return result(
        [...rows, ...groupRows].filter((m) => !s.get("id") || s.get("id").includes(m.id)),
      );
    }
    if (p.includes("/rpc/")) {
      const body = req.postDataJSON() ?? {};
      if (p.endsWith("/get_chat_messages")) {
        pageCalls.push(body);
        const source =
          body.p_chat_id === groupId ? groupRows : body.p_chat_id === selfId ? [] : rows;
        const data = [...source]
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
        readCalls++;
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
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await setup(context);
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const goto = async (id = chatId, search = "") => {
  await page.goto(`http://127.0.0.1:5173/chats/${id}${search}`);
  await page.locator(".message-list").waitFor();
  await page.waitForTimeout(400);
};
const metrics = () =>
  page.locator(".message-list").evaluate((el) => ({
    top: el.scrollTop,
    height: el.scrollHeight,
    client: el.clientHeight,
    bottom: el.scrollHeight - el.clientHeight - el.scrollTop,
  }));
const scroll = async (top) => {
  await page.locator(".message-list").evaluate((el, top) => {
    el.scrollTop = top;
    el.dispatchEvent(new Event("scroll"));
  }, top);
  await page.waitForTimeout(200);
};
try {
  await goto();
  assert.ok((await metrics()).bottom < 5, "Initial scroll reaches bottom");
  assert.equal(await page.locator("[data-message-id]").count(), 50);
  await scroll(50);
  await page.waitForTimeout(500);
  assert.equal(await page.locator("[data-message-id]").count(), 80);
  assert.ok((await metrics()).top > 1000, "Prepend preserves scroll position");
  await scroll(600);
  const before = await metrics();
  const incoming = message(500, {
    sender_id: other,
    created_at: new Date().toISOString(),
    content: "Live message without scroll jump",
  });
  rows.push(incoming);
  emit("messages", incoming);
  await page.getByText(incoming.content).waitFor();
  assert.ok(Math.abs((await metrics()).top - before.top) < 5);
  await page.getByRole("button", { name: "Scroll to latest messages" }).waitFor();
  await page.getByRole("button", { name: "Scroll to latest messages" }).click();
  await page.waitForFunction(() => {
    const el = document.querySelector(".message-list");
    return el.scrollHeight - el.scrollTop - el.clientHeight < 5;
  });
  assert.ok((await metrics()).bottom < 5);
  sendDelay = 500;
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Optimistic hello");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByRole("img", { name: "Sending", exact: true }).waitFor();
  await page.waitForTimeout(750);
  assert.equal(await page.getByText("Optimistic hello", { exact: true }).count(), 1);
  sendDelay = 0;
  failSend = true;
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Please retry me");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByRole("button", { name: "Send failed. Retry" }).waitFor();
  failSend = false;
  await page.getByRole("button", { name: "Send failed. Retry" }).click();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.waitForTimeout(600);
  assert.equal(await page.getByText("Please retry me", { exact: true }).count(), 1);
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Draft survives navigation");
  await page.waitForTimeout(650);
  await page.getByRole("link", { name: "Chats", exact: true }).first().click();
  await page.goto(`http://127.0.0.1:5173/chats/${chatId}`);
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Message", exact: true }).inputValue(),
    "Draft survives navigation",
  );
  await goto(groupId);
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("@sof");
  await page.getByRole("option").waitFor();
  await page.getByRole("textbox", { name: "Message", exact: true }).press("Enter");
  assert.equal(
    await page.getByRole("textbox", { name: "Message", exact: true }).inputValue(),
    "@sofia ",
  );
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.waitForTimeout(400);
  assert.deepEqual(groupRows.at(-1).mentions, [other]);
  assert.equal(await page.locator(".message-mention").textContent(), "@sofia");
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Line one");
  await page.getByRole("textbox", { name: "Message", exact: true }).press("Shift+Enter");
  await page.getByRole("textbox", { name: "Message", exact: true }).type("Line two");
  assert.equal(
    await page.getByRole("textbox", { name: "Message", exact: true }).inputValue(),
    "Line one\nLine two",
  );
  await goto(pendingId);
  await page.getByText("Accept this request to reply.").waitFor();
  assert.equal(await page.locator(".conversation-composer").count(), 0);
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  await goto(selfId);
  await page.getByRole("heading", { name: "A little space for you" }).waitFor();
  // An unread target outside the latest page is loaded before initial scrolling.
  firstUnread = rows[10].id;
  receipts = rows
    .filter((m) => m.sender_id !== me)
    .map((m) => ({ message_id: m.id, user_id: me, delivered_at: m.created_at, read_at: null }));
  readCalls = 0;
  await goto();
  await page.locator("[data-unread-marker]").waitFor();
  assert.ok((await metrics()).bottom > 500);
  await page.waitForTimeout(1200);
  assert.equal(readCalls, 0, "No reads while above bottom");
  await scroll(999999);
  await page.waitForTimeout(1200);
  assert.equal(readCalls, 1, "Initial read after bottom delay");
  const next = message(700, {
    sender_id: other,
    created_at: new Date(Date.now() + 1000).toISOString(),
    content: "Read after half a second",
  });
  rows.push(next);
  receipts.push({ message_id: next.id, user_id: me, delivered_at: next.created_at, read_at: null });
  emit("messages", next);
  await page.getByText(next.content).waitFor();
  const readsBefore = readCalls;
  await page.waitForTimeout(200);
  assert.equal(readCalls, readsBefore);
  await page.waitForTimeout(600);
  assert.equal(readCalls, readsBefore + 1);
  await goto(chatId, `?scrollTo=${rows[5].id}`);
  const target = await page.locator(`[data-message-id="${rows[5].id}"]`).boundingBox();
  const container = await page.locator(".message-list").boundingBox();
  assert.ok(
    target.y >= container.y && target.y < container.y + container.height,
    "Deep link loads older pages",
  );
  // Single-image upload uses the BFF JWT, compressed WebP, tracked metadata.
  await page.getByRole("button", { name: "Attach", exact: true }).click();
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 400;
    const g = c.getContext("2d");
    g.fillStyle = "#2f87ff";
    g.fillRect(0, 0, 600, 400);
    return c.toDataURL().split(",")[1];
  });
  await page.locator("input[type=file]").setInputFiles({
    name: "summer.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await page.getByRole("dialog", { name: "Send attachment" }).waitFor();
  await page.getByLabel("Caption", { exact: true }).fill("Summer image");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("dialog", { name: "Send attachment" }).waitFor({ state: "hidden" });
  assert.equal(uploadBytes.at(-1).type, "image/webp");
  assert.ok(uploadBytes.at(-1).size < 200000);
  assert.equal(uploads.at(-1).status, "completed");
  assert.equal(rows.at(-1).file_upload_id, uploads.at(-1).id);
  await page.getByRole("button", { name: "Open image" }).last().click();
  await page.getByRole("dialog", { name: "Media viewer" }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Media viewer" }).waitFor({ state: "hidden" });

  // Offline emoji fallback still inserts at the saved caret rather than the end.
  const editor = page.getByRole("textbox", { name: "Message", exact: true });
  await editor.fill("Hello world");
  await editor.evaluate((el) => {
    el.focus();
    el.setSelectionRange(5, 5);
    el.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Emoji", exact: true }).click();
  await page.locator(".emoji-choice:visible").first().waitFor();
  const chosen = await page.locator(".emoji-choice:visible").first().textContent();
  await page.locator(".emoji-choice:visible").first().click();
  assert.equal(await editor.inputValue(), `Hello${chosen} world`);
  // Cancel an in-flight file upload: no message is inserted and metadata is cleaned.
  const countBeforeCancel = rows.length;
  await page.getByRole("button", { name: "Attach", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "cancel.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("cancel me"),
  });
  slowUpload = true;
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("dialog", { name: "Send attachment" }).locator("progress").waitFor();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.waitForTimeout(500);
  slowUpload = false;
  assert.equal(rows.length, countBeforeCancel);
  assert.ok(removed.length > 0, "Cancelled upload metadata removed");
  // A real tiny MP4 exercises browser thumbnail extraction and two tracked uploads.
  await page.getByRole("button", { name: "Attach", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "clip.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from(
      "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAPXbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAggAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAwJ0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAggAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAUAAAAC0AAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAIIAAAEAAABAAAAAAJ6bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAyAAAAGgBVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAACJW1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAeVzdGJsAAAAwXN0c2QAAAAAAAAAAQAAALFhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAUAAtABIAAAASAAAAAAAAAABFUxhdmM2MS4xOS4xMDEgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAAN2F2Y0MBZAAM/+EAGmdkAAys2UFBn58BEAAAAwAQAAADAyDxQplgAQAGaOvjyyLA/fj4AAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAADhPAAAAAAAAABhzdHRzAAAAAAAAAAEAAAANAAACAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAeGN0dHMAAAAAAAAADQAAAAEAAAQAAAAAAQAACgAAAAABAAAEAAAAAAEAAAAAAAAAAQAAAgAAAAABAAAKAAAAAAEAAAQAAAAAAQAAAAAAAAABAAACAAAAAAEAAAoAAAAAAQAABAAAAAABAAAAAAAAAAEAAAIAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAANAAAAAQAAAEhzdHN6AAAAAAAAAAAAAAANAAAC9AAAABAAAAANAAAADQAAAA0AAAAWAAAADwAAAA0AAAANAAAAFgAAAA8AAAANAAAADQAAABRzdGNvAAAAAAAAAAEAAAQHAAAAYXVkdGEAAABZbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAsaWxzdAAAACSpdG9vAAAAHGRhdGEAAAABAAAAAExhdmY2MS43LjEwMwAAAAhmcmVlAAADsW1kYXQAAAKuBgX//6rcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY0IHIzMTA4IDMxZTE5ZjkgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDIzIC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgzOjB4MTEzIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0xIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9NiBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTMgYl9weXJhbWlkPTIgYl9hZGFwdD0xIGJfYmlhcz0wIGRpcmVjdD0xIHdlaWdodGI9MSBvcGVuX2dvcD0wIHdlaWdodHA9MiBrZXlpbnQ9MjUwIGtleWludF9taW49MjUgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAA+ZYiEADv//uOr+BSbdB0J5Sk3rRNGNPzxSXbPITNxyv/gd9NWAALGGW9CnGTJVG0AEsAAASwM2GMJqpyT1tkAAAAMQZokbEN//qeEAAP8AAAACUGeQniF/wACbwAAAAkBnmF0Qr8AA1IAAAAJAZ5jakK/AANTAAAAEkGaaEmoQWiZTAhn//6eEAAPmQAAAAtBnoZFESwv/wACbwAAAAkBnqV0Qr8AA1MAAAAJAZ6nakK/AANSAAAAEkGarEmoQWyZTAhX//44QAA9IAAAAAtBnspFFSwv/wACbwAAAAkBnul0Qr8AA1IAAAAJAZ7rakK/AANS",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("dialog", { name: "Send attachment" }).waitFor({ state: "hidden" });
  const sentVideo = rows.at(-1);
  assert.equal(sentVideo.type, "video");
  assert.ok(sentVideo.media_thumbnail_upload_id);
  assert.ok(
    uploads
      .find((u) => u.id === sentVideo.media_thumbnail_upload_id)
      ?.original_filename.endsWith(".thumb.jpg"),
  );
  assert.equal(
    await page.locator(".message-list video").count(),
    0,
    "Videos never autoplay in history",
  );
  await page.getByRole("button", { name: "Play video", exact: true }).last().click();
  await page.locator(".media-lightbox video[autoplay]").waitFor();
  await page.keyboard.press("Escape");
  // Render every remaining type, deleted content, reply previews and safe links.
  const sample = uploads[0];
  const extra = [
    message(801, { type: "audio", file_upload_id: sample.id, content: "Audio caption" }),
    message(802, { type: "file", file_upload_id: sample.id, content: "File caption" }),
    message(803, { type: "sticker", file_upload_id: sample.id }),
    message(804, { type: "location", location_data: { latitude: 19.4326, longitude: -99.1332 } }),
    message(805, {
      type: "contact",
      contact_data: { user_id: other, username: "sofia", display_name: "Sofia Reyes" },
    }),
    message(806, { type: "system", content: "Sofia joined the conversation" }),
    message(807, { deleted_for_everyone: true, content: "NEVER SHOW DELETED CONTENT" }),
    message(808, {
      content: "Read https://example.test and javascript:alert(1)",
      reply_to_message_id: rows[0].id,
    }),
  ].map((m, i) => ({ ...m, created_at: new Date(Date.now() + 2000 + i).toISOString() }));
  rows.push(...extra);
  emit("messages", extra.at(-1));
  await page.getByText("Sofia joined the conversation").waitFor();
  await page.locator(".voice-player").waitFor();
  await page.locator(".message-file").waitFor();
  await page.locator(".message-sticker").waitFor();
  assert.match(
    await page.locator(".message-location").getAttribute("href"),
    /^https:\/\/www.google.com\/maps/,
  );
  assert.equal(await page.getByText("NEVER SHOW DELETED CONTENT").count(), 0);
  await page.getByText("This message was deleted", { exact: true }).waitFor();
  await page.locator(".message-reply").waitFor();
  const external = page.getByRole("link", { name: "https://example.test", exact: true });
  assert.equal(await external.getAttribute("rel"), "noopener noreferrer nofollow");
  assert.equal(await page.locator('a[href^="javascript:"]').count(), 0);
  // Hidden documents never mark messages; returning at bottom marks immediately.
  await scroll(999999);
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hiddenMessage = message(900, {
    sender_id: other,
    content: "Arrived while hidden",
    created_at: new Date(Date.now() + 10000).toISOString(),
  });
  rows.push(hiddenMessage);
  receipts.push({
    message_id: hiddenMessage.id,
    user_id: me,
    delivered_at: hiddenMessage.created_at,
    read_at: null,
  });
  const beforeHidden = readCalls;
  emit("messages", hiddenMessage);
  await page.waitForTimeout(1200);
  assert.equal(readCalls, beforeHidden);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(700);
  assert.equal(readCalls, beforeHidden + 1);

  await page.screenshot({ path: "/workspace/messages-desktop.png", fullPage: true });
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await setup(mobile);
  const mp = await mobile.newPage();
  await mp.goto(`http://127.0.0.1:5173/chats/${groupId}`);
  await mp.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  await mp.waitForTimeout(400);
  assert.equal(
    await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
    "No horizontal mobile overflow",
  );
  const composer = await mp.locator(".conversation-composer").boundingBox();
  assert.ok(composer.y + composer.height <= 844 - 68 + 1, "Composer stays above mobile navigation");
  await mp.screenshot({ path: "/workspace/messages-mobile.png", fullPage: true });
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: paging, scroll anchoring, Realtime, optimistic send/retry, drafts, mentions, multiline, requests, unread timing, deep links, image upload/lightbox, video thumbnails, cancelled uploads, nine renderers, emoji caret, hidden tabs, desktop/mobile layout.",
  );
} finally {
  await browser.close();
}
