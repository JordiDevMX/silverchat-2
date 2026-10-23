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
profiles.push(
  {
    id: uid(3),
    username: "carol",
    display_name: "Carol Chen",
    avatar_url: null,
    last_seen_at: null,
  },
  { id: uid(4), username: "dave", display_name: "Dave Park", avatar_url: null },
);
let groupName = "Weekend people",
  description = "Weekend plans",
  groupAvatar = null,
  memberMode = false,
  reports = [],
  mutedUntil = null,
  pinnedAt = null;
let groupMembers = [
  { user_id: me, role: "admin", joined_at: "2020-01-01" },
  { user_id: other, role: "member", joined_at: "2020-01-02" },
  { user_id: uid(3), role: "admin", joined_at: "2020-01-03" },
];
const hidden = new Set(),
  sharedQueries = [];
let failSettings = false;
const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: me, aal: "aal2", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
const ago = (n) => new Date(Date.now() - n * 60000).toISOString();
const chat = (id = chatId, type = "direct") => ({
  id,
  type,
  name: type === "group" ? groupName : null,
  created_by: me,
  created_at: "2020-01-01T00:00:00Z",
  description,
  direct_pair_key: [me, other].sort().join("::"),
  status: "active",
  avatar_url: type === "group" ? groupAvatar : null,
  community_id: null,
});
const member = (id = chatId, who = me) => ({
  chat_id: id,
  user_id: who,
  role: "member",
  muted_until: mutedUntil,
  pinned_at: pinnedAt,
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
    if (p.endsWith("/reports")) {
      reports.push(req.postDataJSON());
      return response(route, null, 201);
    }
    if (p.endsWith("/user_blocks") || p.endsWith("/profiles_blocked")) return result([]);
    if (p.endsWith("/chats")) {
      const id = s.get("id")?.slice(3) ?? chatId;
      return result(
        (id === pendingId && !accepted) || removedMember
          ? []
          : [chat(id, id === groupId ? "group" : id === selfId ? "self" : "direct")],
      );
    }
    if (p.endsWith("/chat_members")) {
      const id = s.get("chat_id")?.slice(3) ?? chatId;
      if (method === "PATCH") {
        const patch = req.postDataJSON();
        if ("muted_until" in patch) mutedUntil = patch.muted_until;
        if ("pinned_at" in patch) pinnedAt = patch.pinned_at;
        return result([{ chat_id: id }]);
      }
      if (method === "DELETE") {
        groupMembers = groupMembers.filter((m) => m.user_id !== me);
        return result([{ chat_id: id }]);
      }
      if (s.get("select") === "chat_id,chats!inner(type,status)")
        return result([{ chat_id: chatId, chats: { type: "direct", status: "active" } }]);
      if (s.get("select") === "user_id") return result([{ user_id: other }, { user_id: uid(4) }]);
      if (id === groupId && !s.get("select")?.includes("chat:chats"))
        return result(
          groupMembers.map((m) => ({
            ...member(id, m.user_id),
            ...m,
            role: m.user_id === me && memberMode ? "member" : m.role,
          })),
        );

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
    if (p.endsWith("/message_deletions"))
      return result([...hidden].map((message_id) => ({ message_id })));
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
      if (s.has("type")) {
        sharedQueries.push(s.get("type"));
        const media = s.get("type").includes("image");
        const data = media ? mediaRows : fileRows;
        const offset = Number(s.get("offset") ?? 0),
          limit = Number(s.get("limit") ?? 30);
        return result(data.slice(offset, offset + limit));
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
        [...rows, ...groupRows].filter((m) => !s.get("id") || s.get("id").includes(m.id)),
      );
    }
    if (p.includes("/rpc/")) {
      const body = req.postDataJSON() ?? {};
      if (p.endsWith("/update_group_info")) {
        if (failSettings) return response(route, { message: "Group admin required" }, 400);
        if (body.p_name !== undefined) groupName = body.p_name;
        if (body.p_description !== undefined) description = body.p_description;
        if (body.p_avatar_url !== undefined) groupAvatar = body.p_avatar_url || null;
        return response(route, null);
      }
      if (p.endsWith("/promote_chat_admin") || p.endsWith("/demote_chat_admin")) {
        const member = groupMembers.find((m) => m.user_id === body.p_user_id);
        member.role = p.endsWith("/promote_chat_admin") ? "admin" : "member";
        return response(route, null);
      }
      if (p.endsWith("/remove_chat_member")) {
        groupMembers = groupMembers.filter((m) => m.user_id !== body.p_user_id);
        return response(route, null);
      }
      if (p.endsWith("/add_chat_members")) {
        let added = 0;
        for (const id of body.p_user_ids) {
          if (!groupMembers.some((m) => m.user_id === id)) {
            groupMembers.push({ user_id: id, role: "member", joined_at: new Date().toISOString() });
            added++;
          }
        }
        return response(route, added);
      }
      if (p.endsWith("/clear_chat_for_me")) {
        for (const m of rows) hidden.add(m.id);
        return response(route, rows.length);
      }
      if (p.endsWith("/get_chat_messages")) {
        pageCalls.push(body);
        const source =
          body.p_chat_id === groupId ? groupRows : body.p_chat_id === selfId ? [] : rows;
        const data = [...source]
          .filter((m) => !hidden.has(m.id))
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
const mediaRows = Array.from({ length: 35 }, (_, i) =>
  message(700 + i, {
    chat_id: groupId,
    type: i === 0 ? "video" : "image",
    file_upload_id: uid(800 + i),
    media_thumbnail_upload_id: i === 0 ? uid(800) : null,
  }),
);
const fileRows = [message(900, { chat_id: groupId, type: "file", file_upload_id: uid(900) })];
uploads.push(
  ...[...mediaRows, ...fileRows].map((m) => ({
    id: m.file_upload_id,
    bucket: "chat-media",
    path: `${groupId}/${m.id}/file`,
    original_filename: m.type === "file" ? "weekend-plans.pdf" : "photo.png",
    mime_type: m.type === "file" ? "application/pdf" : "image/png",
    size_bytes: 4096,
    status: "completed",
    uploader_id: me,
  })),
);
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await setup(context);
const page = await context.newPage();
page.setDefaultTimeout(10000);
page.on("pageerror", (e) => errors.push(e.message));
const goto = async (id = chatId, suffix = "") => {
  await page.goto(`http://127.0.0.1:5173/chats/${id}${suffix}`);
  await page.locator(suffix ? ".chat-settings-screen > header" : ".conversation-header").waitFor();
  await page.waitForTimeout(400);
};
const options = async (action) => {
  await page.getByRole("button", { name: "Chat options", exact: true }).click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
};
const settle = () => page.waitForTimeout(350);
try {
  await goto(pendingId);
  await page.locator("button.conversation-identity").click();
  assert.equal(
    await page.getByRole("button", { name: "Call", exact: true }).getAttribute("title"),
    "Accept the chat request first",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await goto(selfId);
  await page.getByRole("button", { name: "Chat options", exact: true }).click();
  assert.equal(await page.getByRole("menuitem").count(), 3);
  await page.keyboard.press("Escape");
  await goto();
  await page.locator("button.conversation-identity").click();
  await page.getByRole("dialog", { name: "Contact profile" }).waitFor();
  assert.ok(await page.getByRole("heading", { name: "Sofia Reyes", exact: true }).isVisible());
  assert.equal(
    await page.getByRole("button", { name: "Call", exact: true }).getAttribute("title"),
    "Calls coming soon",
  );
  await page.getByRole("button", { name: "Block", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await page.locator("button.conversation-identity").click();
  await page.getByRole("button", { name: "Report", exact: true }).click();
  await page.getByLabel("Other", { exact: true }).check();
  assert.equal(await page.getByRole("button", { name: "Submit report" }).isDisabled(), true);
  await page.getByRole("textbox", { name: "Description", exact: true }).fill("Test description");
  await page.getByRole("button", { name: "Submit report" }).click();
  await settle();
  assert.equal(reports[0].reason, "other");
  assert.equal(reports[0].reporter_id, me);
  await options("Mute");
  await page.getByRole("button", { name: "8 hours", exact: true }).click();
  await settle();
  assert.ok(Date.parse(mutedUntil) > Date.now() + 7.9 * 3600000);
  await options("Unmute");
  await settle();
  assert.equal(mutedUntil, null);
  await options("Pin");
  await settle();
  assert.ok(pinnedAt);
  await options("Unpin");
  await settle();
  assert.equal(pinnedAt, null);
  await page.getByRole("button", { name: "Chat options", exact: true }).click();
  assert.equal(await page.getByRole("menuitem").count(), 8);
  await page.keyboard.press("Escape");
  await options("Clear chat");
  await page.getByRole("dialog").getByRole("button", { name: "Clear chat", exact: true }).click();
  await settle();
  assert.equal(await page.locator("[data-message-id]").count(), 0);
  assert.equal(rows.length, 80);
  await page.goto("http://127.0.0.1:5173/chats");
  await page.locator(".chat-list-item").first().waitFor();
  await settle();
  assert.equal(
    await page.getByText("See you soon", { exact: true }).count(),
    0,
    "Cleared preview is hidden in the chat list",
  );
  profiles[1].avatar_url = `${other}/avatar.webp`;
  await goto(groupId);
  assert.equal(
    await page.locator(".conversation-identity .group-avatar-placeholder").count(),
    1,
    "Group without photo does not borrow a member avatar",
  );
  await page.locator("button.conversation-identity").click();
  await page.getByRole("heading", { name: "Group info", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Group name", exact: true }).fill("Renamed weekend");
  await page.getByRole("textbox", { name: "Group name", exact: true }).press("Tab");
  await settle();
  assert.equal(groupName, "Renamed weekend");
  failSettings = true;
  await page.getByRole("textbox", { name: "Group name", exact: true }).fill("Unsaved name");
  await page.getByRole("textbox", { name: "Group name", exact: true }).press("Tab");
  await page.getByRole("alert").filter({ hasText: "Unable to save group details" }).waitFor();
  assert.equal(groupName, "Renamed weekend");
  failSettings = false;
  await page.getByRole("textbox", { name: "Group name", exact: true }).fill("Renamed weekend");
  await page.getByRole("button", { name: "Change photo", exact: true }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#7048e8";
    ctx.fillRect(0, 0, 120, 120);
    return canvas.toDataURL().split(",")[1];
  });
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "group.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await settle();
  assert.match(groupAvatar, new RegExp(`^chat-${groupId}/group-.*\\.webp$`));
  assert.equal(uploadBytes.at(-1).type, "image/webp");
  await page.getByRole("link", { name: "View members →" }).click();
  await page.getByRole("heading", { name: "3 members", exact: true }).waitFor();
  await page.getByRole("button", { name: "Member actions: Sofia Reyes" }).click();
  await page.getByRole("button", { name: "Promote to admin", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await settle();
  assert.equal(groupMembers.find((m) => m.user_id === other).role, "admin");
  await page.getByRole("button", { name: "Member actions: Sofia Reyes" }).click();
  await page.getByRole("button", { name: "Demote from admin", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await settle();
  assert.equal(groupMembers.find((m) => m.user_id === other).role, "member");
  await page.getByRole("button", { name: "Member actions: Alice Rivera" }).click();
  assert.equal(
    await page.getByRole("button", { name: "Demote from admin", exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Member actions: Alice Rivera" }).click();
  await page.getByRole("button", { name: "Member actions: Sofia Reyes" }).click();
  await page.getByRole("button", { name: "Remove from group", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await settle();
  assert.equal(groupMembers.length, 2);
  await page.getByRole("button", { name: "+ Add", exact: true }).click();
  await page.getByRole("searchbox").fill("dave");
  await settle();
  await page.getByRole("checkbox", { name: /Dave Park/ }).check();
  await page.getByRole("button", { name: "Add 1 members", exact: true }).click();
  await settle();
  assert.ok(groupMembers.some((m) => m.user_id === uid(4)));
  await goto(groupId, "/media?tab=media");
  await page.getByRole("button", { name: "Open image", exact: true }).first().waitFor();
  assert.equal(await page.getByRole("button", { name: "Open image", exact: true }).count(), 29);
  assert.ok(!sharedQueries.some((q) => q === "in.(file)"));
  await page.getByRole("button", { name: "Load more" }).click();
  await settle();
  assert.equal(await page.locator(".shared-media-tile").count(), 35);
  await page.getByRole("button", { name: "Open image", exact: true }).first().click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Files", exact: true }).click();
  await page.getByText("weekend-plans.pdf", { exact: true }).waitFor();
  assert.match(page.url(), /tab=files/);
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Download file" }).click();
  const popup = await popupPromise;
  await popup.waitForURL(/storage/);
  await popup.close();
  await goto(groupId, "/info");
  memberMode = true;
  emit("chat_members", { ...member(groupId), role: "member" }, "UPDATE");
  await page
    .getByRole("textbox", { name: "Group name", exact: true })
    .waitFor({ state: "detached" });
  assert.equal(await page.getByRole("textbox", { name: "Group name", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Change photo", exact: true }).count(), 0);
  await goto(groupId);
  await page.getByRole("button", { name: "Chat options", exact: true }).click();
  assert.equal(await page.getByRole("menuitem", { name: "Add members", exact: true }).count(), 0);
  await page.keyboard.press("Escape");
  memberMode = false;
  await goto(groupId, "/info");
  await page.screenshot({ path: "/workspace/chat-settings-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Leave group", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Leave group", exact: true }).click();
  await page.waitForURL("**/chats");
  assert.ok(!groupMembers.some((m) => m.user_id === me));
  await page.locator(".chat-settings-notice").filter({ hasText: "You left the group" }).waitFor();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await setup(mobile);
  const mp = await mobile.newPage();
  await mp.goto(`http://127.0.0.1:5173/chats/${chatId}`);
  await mp.locator("button.conversation-identity").click();
  await mp.getByRole("dialog", { name: "Contact profile" }).waitFor();
  assert.equal(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mp.screenshot({ path: "/workspace/chat-settings-mobile.png", fullPage: true });
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: contact modal, reports, direct menu/mute/pin, clear history, group fields/avatar crop+upload, member promote/demote/remove/add, creator protection UI, shared media lazy tabs/paging/lightbox/download, member-only views, leave, mobile layout.",
  );
} catch (error) {
  await page.screenshot({ path: "/workspace/chat-settings-failure.png", fullPage: true });
  throw error;
} finally {
  await browser.close();
}
