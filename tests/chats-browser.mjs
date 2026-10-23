// Chromium against mocked HTTP/Realtime boundaries. Never touches remote accounts.
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const me = "11111111-1111-4111-8111-111111111111";
const uid = (n) => `${String(n).padStart(8, "0")}-2222-4222-8222-222222222222`;
const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: me, aal: "aal2", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
const user = {
  id: me,
  email: "alice@example.test",
  aud: "authenticated",
  role: "authenticated",
  user_metadata: {},
  app_metadata: {},
  factors: [],
};
const profile = {
  id: me,
  username: "alice",
  display_name: "Alice Rivera",
  avatar_url: null,
  first_name: "Alice",
  last_name: "Rivera",
  social_links: {},
  scheduled_deletion_at: null,
};
const profiles = [
  profile,
  ...[
    "Sofia Reyes",
    "Mateo Cruz",
    "Nora Bennett",
    "Leo Park",
    "Olivia Chen",
    "Daniel Kim",
    "Maya Lee",
    "Samuel Green",
  ].map((name, i) => ({
    id: uid(i + 1),
    username: name.split(" ")[0].toLowerCase(),
    display_name: name,
    avatar_url: null,
    avatar_initials: name
      .split(" ")
      .map((w) => w[0])
      .join(""),
    last_seen_at: i === 0 ? new Date().toISOString() : null,
  })),
];
const ago = (n) => new Date(Date.now() - n * 3600000).toISOString();
const membership = (i, name, type = "direct", preview = "See you soon!") => ({
  chat_id: uid(100 + i),
  user_id: me,
  pinned_at: null,
  favorited_at: null,
  archived_at: null,
  muted_until: null,
  manually_unread: false,
  chat: {
    id: uid(100 + i),
    type,
    status: "active",
    name,
    avatar_url: null,
    direct_pair_key: type === "direct" ? `${me}::${uid(i)}` : null,
    last_message_at: ago(i),
    last_message_preview: preview,
    last_message_id: uid(200 + i),
    last_message: {
      id: uid(200 + i),
      sender_id: i === 2 ? me : uid(i),
      type: "text",
      deleted_for_everyone: false,
    },
  },
});
let memberships = [
  membership(1, null, "direct", "Coffee tomorrow? I found a lovely spot."),
  membership(2, null, "direct", "Perfect, I’ll send the details."),
  membership(3, "Weekend people", "group", "Anyone up for a walk on Saturday?"),
  membership(4, null, "direct", "Thanks for the photos!"),
  membership(5, null, "direct", "The final files are ready."),
  membership(6, null, "direct", "Catch you later."),
];
memberships[0].pinned_at = ago(3);
memberships[1].favorited_at = ago(2);
memberships[4].archived_at = ago(1);
memberships[5].muted_until = "9999-12-31T00:00:00Z";
let requests = [7, 8, 9, 10].map((n, i) => ({
  id: uid(300 + n),
  sender_id: uid(i + 3),
  chat_id: uid(400 + n),
  created_at: ago(i),
  chat: {
    last_message_preview: [
      "Hey Alice! Great meeting you.",
      "About the design meetup…",
      "Hello!",
      "Let’s catch up",
    ][i],
  },
}));
const unreadCounts = new Map([
  [uid(101), 1025],
  [uid(103), 3],
  [uid(106), 8],
]);
let failId = null,
  failAction = null,
  mainReads = 0,
  recordedChanges = [];
let liveSocket = null,
  liveConfig = [];
const wire = (m) =>
  JSON.stringify([m.join_ref ?? null, m.ref ?? null, m.topic, m.event, m.payload]);
const fulfill = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
async function mockContext(browserContext) {
  await browserContext.route("**/api/auth/**", (route) =>
    fulfill(route, {
      accessToken: jwt,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      user,
      aal: "aal2",
      mfaRequired: false,
      factorId: null,
    }),
  );
  await browserContext.route("https://supabase.test/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      method = req.method(),
      s = url.searchParams;
    if (path.endsWith("/user")) return fulfill(route, user);
    if (path.endsWith("/profiles")) return fulfill(route, profile);
    if (path.endsWith("/user_settings"))
      return fulfill(route, {
        user_id: me,
        theme: "light",
        accent: "blue",
        language: "en",
        read_receipts_enabled: true,
      });
    if (path.endsWith("/profiles_visible")) return fulfill(route, profiles);
    if (path.endsWith("/profiles_blocked") || path.endsWith("/user_blocks"))
      return fulfill(route, []);
    if (path.endsWith("/chats"))
      return fulfill(
        route,
        memberships.find((m) => m.chat_id === s.get("id")?.slice(3))?.chat ?? null,
      );
    if (path.endsWith("/chat_members")) {
      const id = s.get("chat_id")?.replace("eq.", "");
      if (method === "PATCH") {
        if (id === failId) return fulfill(route, { message: "Offline" }, 503);
        const patch = req.postDataJSON();
        recordedChanges.push({ id, patch });
        Object.assign(memberships.find((m) => m.chat_id === id) ?? {}, patch);
        return fulfill(route, { chat_id: id });
      }
      if (method === "DELETE") {
        memberships = memberships.filter((m) => m.chat_id !== id);
        return fulfill(route, [{ chat_id: id }]);
      }
      if (s.get("chat_id")?.startsWith("eq.") && s.get("select") === "*")
        return fulfill(route, [{ chat_id: id, user_id: me, role: "member", joined_at: ago(200) }]);
      if (s.get("select")?.includes("chat:chats")) {
        mainReads++;
        assert.equal(s.get("limit"), "200");
        assert.equal(s.get("chat.status"), "eq.active");
        assert.match(
          s.get("order"),
          /pinned_at.desc.nullslast,chat\(last_message_at\).desc.nullslast/,
        );
        return fulfill(route, memberships);
      }
      return fulfill(
        route,
        memberships.flatMap((m, i) => [
          { chat_id: m.chat_id, user_id: me, role: "member" },
          { chat_id: m.chat_id, user_id: uid(i + 1), role: "member" },
          ...(m.chat.type === "group"
            ? [{ chat_id: m.chat_id, user_id: uid(7), role: "admin" }]
            : []),
        ]),
      );
    }
    if (path.endsWith("/message_receipts")) {
      if (s.get("select")?.includes("message:messages")) return fulfill(route, null);
      if (s.has("read_at")) {
        const rows = [...unreadCounts].flatMap(([chat_id, count]) =>
          Array.from({ length: count }, (_, i) => ({
            message_id: `${chat_id}-${i}`,
            messages: { chat_id },
          })),
        );
        const offset = Number(s.get("offset") ?? 0),
          limit = Number(s.get("limit") ?? 500);
        return fulfill(route, rows.slice(offset, offset + limit));
      }
      return fulfill(route, [
        { message_id: uid(202), user_id: uid(2), delivered_at: ago(1), read_at: ago(0.5) },
      ]);
    }
    if (path.endsWith("/chat_requests")) return fulfill(route, s.has("chat_id") ? null : requests);
    if (path.endsWith("/messages"))
      return fulfill(
        route,
        requests
          .filter((r) => r.chat.last_message_preview)
          .map((r) => ({
            id: r.id,
            chat_id: r.chat_id,
            content: r.chat.last_message_preview,
            type: "text",
            deleted_for_everyone: false,
            created_at: new Date().toISOString(),
          })),
      );
    if (path.includes("/rpc/")) {
      const body = req.postDataJSON() ?? {},
        action = path.split("/").pop(),
        id = body.p_chat_id;
      if (action === failAction && id === failId)
        return fulfill(route, { message: "Permission denied" }, 403);
      const row = memberships.find((m) => m.chat_id === id);
      if (action === "get_chat_messages") return fulfill(route, []);
      if (action === "mark_chat_as_read") {
        if (row) row.manually_unread = false;
        unreadCounts.set(id, 0);
      }
      if (action === "mark_chat_as_unread" && row) row.manually_unread = true;
      if (action === "delete_direct_chat_for_me" || action === "delete_self_chat")
        memberships = memberships.filter((m) => m.chat_id !== id);
      if (action === "accept_chat_request" || action === "reject_chat_request") {
        const r = requests.find((r) => r.id === body.p_request_id);
        requests = requests.filter((r) => r.id !== body.p_request_id);
        if (action === "accept_chat_request")
          memberships.push({
            ...membership(7, null),
            chat_id: r.chat_id,
            chat: { ...membership(7, null).chat, id: r.chat_id },
          });
      }
      if (action === "create_self_chat") {
        const own = membership(20, "Notes", "self");
        memberships.push(own);
        return fulfill(route, own.chat_id);
      }
      return fulfill(route, null);
    }
    return fulfill(route, []);
  });
  await browserContext.routeWebSocket("**/realtime/v1/websocket**", (socket) => {
    socket.onMessage((raw) => {
      const decoded = JSON.parse(String(raw));
      const msg = Array.isArray(decoded)
        ? {
            join_ref: decoded[0],
            ref: decoded[1],
            topic: decoded[2],
            event: decoded[3],
            payload: decoded[4],
          }
        : decoded;
      if (msg.event === "phx_join") {
        liveSocket = socket;
        liveConfig = msg.payload.config.postgres_changes.map((c, i) => ({ ...c, id: i + 1 }));
        socket.send(
          wire({
            topic: msg.topic,
            event: "phx_reply",
            payload: { status: "ok", response: { postgres_changes: liveConfig } },
            ref: msg.ref,
            join_ref: msg.join_ref,
          }),
        );
      } else if (msg.event === "heartbeat")
        socket.send(wire({ ...msg, event: "phx_reply", payload: { status: "ok", response: {} } }));
    });
  });
}
const realtime = (table, record) => {
  assert.ok(liveSocket, "Realtime connected");
  const ids = liveConfig.filter((c) => c.table === table).map((c) => c.id);
  liveSocket.send(
    wire({
      topic: `realtime:chats-list:${me}`,
      event: "postgres_changes",
      payload: {
        ids,
        data: {
          schema: "public",
          table,
          commit_timestamp: new Date().toISOString(),
          type: "INSERT",
          columns: Object.keys(record).map((name) => ({ name, type: "text" })),
          record,
          old_record: {},
          errors: null,
        },
      },
    }),
  );
};
await mockContext(context);
let page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const row = (id) => page.locator(`[data-chat-id="${uid(id)}"]`);
const filter = (name) => page.locator(".chat-filters").getByRole("button", { name, exact: true });
const menu = async (id, label) => {
  await row(id).locator(".chat-row-main").click({ button: "right" });
  await page.getByRole("menuitem", { name: label, exact: true }).click();
};
const waitRefresh = async () => {
  await page.getByRole("button", { name: "Refresh", exact: true }).waitFor({ state: "visible" });
  await page.waitForFunction(() => !document.querySelector(".chat-refresh")?.disabled);
};
try {
  await page.goto("http://127.0.0.1:5173/chats");
  await row(101).waitFor();
  assert.equal(await page.locator(".chat-filters button").count(), 7);
  assert.equal(await page.locator(".chat-list-item").count(), 5);
  assert.equal(await row(101).locator(".chat-badge").textContent(), "99+");
  assert.equal(await row(106).locator(".chat-badge").count(), 0);
  assert.equal(await page.locator(".request-row").count(), 3);
  await page.screenshot({ path: "/tmp/silverchat-chats-desktop.png", fullPage: true });
  console.log(
    "PASS batched unread pagination, receipt rendering, request collapse, muted/global badges",
  );
  for (const [name, count] of [
    ["Favorites", 1],
    ["Unread", 3],
    ["Groups", 1],
    ["Archived", 1],
    ["Muted", 1],
    ["Blocked", 0],
    ["All", 5],
  ]) {
    await filter(name).click();
    await page.waitForFunction(
      (n) => document.querySelectorAll(".chat-list-item").length === n,
      count,
    );
    assert.equal(
      new URL(page.url()).searchParams.get("filter"),
      name === "All" ? null : name.toLowerCase(),
    );
  }
  await page.getByRole("searchbox").fill("Maya");
  await filter("Groups").click();
  await page.waitForURL("**q=Maya");
  assert.equal(new URL(page.url()).searchParams.get("filter"), "groups");
  await page.getByRole("searchbox").fill("Maya");
  await row(103).waitFor();
  await page.waitForURL("**q=Maya");
  await page.getByRole("searchbox").fill("Olivia");
  await page.getByRole("heading", { name: "No chats match “Olivia”" }).waitFor();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.waitForURL("**filter=groups");
  await filter("All").click();
  await page.goBack();
  await filter("Groups")
    .getAttribute("aria-pressed")
    .then((v) => assert.equal(v, "true"));
  await filter("All").click();
  console.log("PASS seven URL filters, debounced scoped search, member search and browser back");
  await menu(104, "Pin");
  await waitRefresh();
  assert.equal(
    await page.locator(".chat-list-item").first().getAttribute("data-chat-id"),
    uid(104),
  );
  await menu(104, "Favorite");
  await waitRefresh();
  await filter("Favorites").click();
  await row(104).waitFor();
  await filter("All").click();
  await menu(104, "Mark as unread");
  await waitRefresh();
  await row(104).locator(".unread-dot").waitFor();
  await menu(104, "Mute");
  await page.getByRole("menuitem", { name: "1 hour", exact: true }).click();
  await waitRefresh();
  await row(104).locator(".unread-dot").waitFor();
  await menu(104, "Archive");
  await row(104).waitFor({ state: "hidden" });
  await waitRefresh();
  await filter("Archived").click();
  await row(104).waitFor();
  await menu(104, "Unarchive");
  await waitRefresh();
  await filter("All").click();
  failId = uid(102);
  await menu(102, "Archive");
  await page.getByRole("alert").filter({ hasText: "Could not update chats" }).waitFor();
  await row(102).waitFor();
  failId = null;
  console.log("PASS context menu pin/favorite/mute/archive/manual unread and optimistic rollback");
  await page.evaluate(
    ({ id, owner }) => {
      localStorage.setItem(
        `silverchat_draft_${id}`,
        JSON.stringify({
          text: "Remember the tickets",
          mediaUrls: [],
          replyToId: null,
          updatedAt: new Date().toISOString(),
          ownerId: owner,
        }),
      );
      window.dispatchEvent(new Event("silverchat:drafts"));
    },
    { id: uid(101), owner: me },
  );
  await row(101).getByText("Draft: Remember the tickets").waitFor();
  assert.equal(await row(101).locator(".chat-badge").textContent(), "99+");
  await page.getByRole("button", { name: "Select", exact: true }).click();
  const visible = await page
    .locator(".chat-list-item")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-chat-id")));
  await page.locator(`[data-chat-id="${visible[0]}"] .chat-row-main`).click();
  await page
    .locator(`[data-chat-id="${visible[2]}"] .chat-row-main`)
    .click({ modifiers: ["Shift"] });
  await page.getByText("3 selected", { exact: true }).waitFor();
  assert.ok(new URL(page.url()).searchParams.get("selectedIds"));
  await page.getByRole("toolbar").getByRole("button", { name: "Mute", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector(".chat-selection-bar button")?.disabled);
  assert.equal(
    recordedChanges.filter((c) => c.patch.muted_until === "9999-12-31T00:00:00Z").length,
    3,
  );
  await page.getByRole("button", { name: "Exit selection" }).click();
  console.log("PASS same-tab drafts preserve unread, shift range selection and bulk mute");
  await page.getByRole("button", { name: "See all", exact: true }).click();
  assert.equal(await page.locator(".request-row").count(), 4);
  await page.getByRole("button", { name: "Accept Nora Bennett", exact: true }).click();
  await page.getByText("Chat request accepted", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Decline Leo Park", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Decline", exact: true }).click();
  await page.getByText("Chat request declined", { exact: true }).waitFor();
  console.log("PASS accept and confirmed decline of requests");
  const before = mainReads;
  memberships.push(membership(8, null, "direct", "A new conversation from another device"));
  realtime("messages", { id: uid(208), chat_id: uid(108), sender_id: uid(8) });
  await row(108).waitFor();
  assert.ok(mainReads > before);
  requests.push({
    id: uid(399),
    sender_id: uid(8),
    chat_id: uid(499),
    created_at: ago(0),
    chat: { last_message_preview: null },
  });
  realtime("chat_requests", { id: uid(399), recipient_id: me, sender_id: uid(8) });
  await page.getByRole("button", { name: "Accept Samuel Green", exact: true }).waitFor();
  console.log("PASS Realtime updates include previously unknown chats and empty requests");
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await row(102).locator(".chat-row-main").click();
  await row(108).locator(".chat-row-main").click();
  failId = uid(108);
  failAction = "delete_direct_chat_for_me";
  await page.getByRole("toolbar").getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog").getByRole("alert").waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll(".chat-delete-summary li").length === 1,
  );
  assert.equal(await row(102).count(), 0);
  failId = null;
  failAction = null;
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Exit selection" }).click();
  console.log("PASS partial bulk delete retries only failed items");
  await page.locator(".new-chat-fab").click();
  await page.getByRole("button", { name: "Message yourself", exact: true }).click();
  await page.getByRole("heading", { name: "A little space for you" }).waitFor();
  await page.locator('.app-navigation a[href="/chats"]').click();
  await row(120).waitFor();
  assert.equal(memberships.find((m) => m.chat_id === uid(120)).pinned_at, null);
  assert.deepEqual(errors, []);
  console.log("PASS self-chat creation remains unpinned and opens the conversation composer");
  // A separate mobile browser context uses native touch media and input.
  await page.close();
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await mockContext(mobileContext);
  page = await mobileContext.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5173/chats");
  await row(103).waitFor();
  const cdp = await mobileContext.newCDPSession(page);
  assert.equal(await page.evaluate(() => matchMedia("(pointer: coarse)").matches), true);
  const target = row(103).locator(".chat-row-main");
  await target.scrollIntoViewIfNeeded();
  let rect = await target.boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 150, y: rect.y + 30 }],
  });
  await page.getByRole("menu").waitFor();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.keyboard.press("Escape");
  await page.getByRole("menu").waitFor({ state: "hidden" });
  rect = await target.boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 290, y: rect.y + 30 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 205, y: rect.y + 30 }],
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const archive = row(103)
    .locator(".chat-swipe")
    .getByRole("button", { name: "Archive", exact: true });
  await page.waitForFunction((id) => {
    const element = document.querySelector(`[data-chat-id="${id}"] .chat-swipe-content`);
    return element && new DOMMatrix(getComputedStyle(element).transform).m41 <= -159;
  }, uid(103));
  await archive.tap();
  await row(103).waitFor({ state: "hidden" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/silverchat-chats-mobile.png", fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  console.log("PASS mobile long-press, swipe action, and no horizontal overflow");
  await page.locator(".new-chat-fab").click();
  await page.getByRole("dialog").waitFor();
  const sheet = await page.getByRole("dialog").boundingBox();
  assert.ok(sheet.y + sheet.height >= 843);
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await page.screenshot({ path: "/tmp/silverchat-chats-dark.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log("Chats browser checks passed; no uncaught page errors.");
} catch (error) {
  console.error(
    "Failed at",
    page.url(),

    errors,
    await page.locator("body").textContent(),
  );
  throw error;
} finally {
  await browser.close();
}
