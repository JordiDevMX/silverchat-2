// Chromium against mocked HTTP/Realtime boundaries. Never touches remote accounts.
import assert from "node:assert/strict";
import { launchBrowser } from "./lib/browser.mjs";

const browser = await launchBrowser({ args: ["--no-sandbox"] });
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
const membership = (i, name, type = "direct", preview = "See you soon!", messageType = "text") => ({
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
      type: messageType,
      deleted_for_everyone: false,
    },
  },
});
const creationCalls = [];
let failGroupCreation = false;
let memberships = [
  membership(1, null, "direct", "Coffee tomorrow? I found a lovely spot."),
  membership(2, null, "direct", "📄 Q4-report.pdf", "file"),
  membership(3, "Weekend people", "group", "📷 Photo — Sunset at the beach", "image"),
  membership(4, null, "direct", "📷 Photo", "image"),
  membership(5, null, "direct", "The final files are ready."),
  membership(6, null, "direct", "Catch you later."),
  membership(9, "General", "community_chat", "Welcome to the community."),
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
  [uid(109), 3],
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
      if (s.get("chat.type") === "eq.direct") {
        assert.equal(s.get("chat.status"), "eq.active");
        return fulfill(
          route,
          memberships.filter((m) => m.chat.type === "direct"),
        );
      }
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
      if (action === "create_group_chat" || action === "create_direct_chat_request") {
        creationCalls.push({ action, body });
        if (action === "create_group_chat" && failGroupCreation)
          return fulfill(route, { message: "Creation offline" }, 503);
        await new Promise((resolve) => setTimeout(resolve, 150));
        const created =
          action === "create_group_chat"
            ? membership(40, body.p_name, "group")
            : membership(30, null, "direct");
        if (action === "create_direct_chat_request")
          created.chat.direct_pair_key = `${me}::${body.p_target_user_id}`;
        memberships.push(created);
        return fulfill(route, created.chat_id);
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
  await page.waitForFunction(
    () => document.querySelector(".chats-page")?.getAttribute("aria-busy") === "false",
  );
};
try {
  await page.goto(`${process.env.UI_BASE_URL ?? "http://127.0.0.1:5173"}/chats`);
  await row(101).waitFor();
  assert.equal(await page.locator(".chat-filters button").count(), 7);
  assert.equal(await page.locator(".chat-list-item").count(), 6);
  assert.equal(await row(101).locator(".chat-badge").textContent(), "99+");
  assert.equal(await row(106).locator(".chat-badge").count(), 0);
  assert.equal(await page.locator(".request-row").count(), 0);
  assert.equal(await page.locator(".request-toggle").getAttribute("aria-expanded"), "false");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  assert.equal(await navigation.count(), 1);
  assert.deepEqual(
    await navigation
      .locator("a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
    ["/chats", "/novedades", "/communities", "/calls", "/settings"],
  );
  assert.equal(await navigation.locator('[aria-current="page"]').getAttribute("href"), "/chats");
  assert.equal(await navigation.getByRole("img", { name: "1028 Unread" }).textContent(), "99+");
  // Community chats notify the Communities tab, never the Chats tab.
  assert.equal(
    await navigation
      .locator('a[href="/communities"]')
      .getByRole("img", { name: "3 Unread" })
      .textContent(),
    "3",
  );
  assert.equal(await navigation.locator('a[href="/chats"]').getByRole("img").count(), 1);
  for (const width of [390, 767, 768, 1023, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.locator(".sidebar-actions .install-button").isVisible(), true);
    assert.equal(await page.locator(".chat-details-pane").count(), 0);
    assert.equal(await navigation.locator(".nav-logout").isVisible(), width >= 1024);
    assert.equal(await navigation.locator(".nav-settings").isVisible(), width < 1024);
    assert.equal(
      await page.locator(".chat-search").evaluate((el) => getComputedStyle(el).borderTopWidth),
      "1px",
    );
    const frame = await navigation.boundingBox();
    const content = await page.locator(".authenticated-content").boundingBox();
    assert.equal(Math.round(frame.width), width >= 1024 ? 68 : width);
    assert.equal(Math.round(content.x), width >= 1024 ? 68 : 0);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    assert.equal(await navigation.locator("a").count(), 5);
    if (width < 1024) {
      const fab = await page.locator(".new-chat-fab").boundingBox();
      assert.ok(fab.y + fab.height < frame.y, "Floating action clears bottom tabs");
    }
  }
  const chatsLink = navigation.locator('a[href="/chats"]');
  await chatsLink.focus();
  assert.equal(
    await chatsLink.locator(".app-nav-label").evaluate((el) => getComputedStyle(el).opacity),
    "1",
  );
  assert.equal(await chatsLink.evaluate((el) => getComputedStyle(el).outlineStyle), "solid");
  assert.notEqual(
    await chatsLink.locator(".app-nav-icon").evaluate((el) => getComputedStyle(el).boxShadow),
    "none",
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await navigation
      .locator('a[href="/novedades"]')
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.locator(".chat-search input").focus();
  console.log(
    "PASS shell breakpoints, five URLs, single navigation, active state, keyboard labels, unread exclusions and floating-action clearance",
  );
  const install = page.getByRole("button", { name: "Install SilverChat" });
  const theme = page.locator(".sidebar-actions button").first();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fill = () => install.evaluate((el) => getComputedStyle(el).backgroundColor);
  const verifyInstallColors = async (background, text, border) => {
    const { gradient, glow } = await install.evaluate((el) => {
      const probe = document.createElement("span");
      probe.style.backgroundImage = "var(--gradient-neon)";
      probe.style.boxShadow = "var(--shadow-glow)";
      el.append(probe);
      const style = getComputedStyle(probe);
      const tokens = { gradient: style.backgroundImage, glow: style.boxShadow };
      probe.remove();
      return tokens;
    });
    assert.match(gradient, /^linear-gradient/);
    assert.notEqual(glow, "none");
    const colors = () =>
      install.evaluate(async (el) => {
        await Promise.all(
          el.getAnimations({ subtree: true }).map((animation) => animation.finished),
        );
        const style = getComputedStyle(el);
        const overlay = getComputedStyle(el, "::before");
        return [
          style.backgroundColor,
          style.color,
          style.borderTopColor,
          style.borderTopWidth,
          style.boxShadow,
          overlay.backgroundImage,
          overlay.opacity,
        ];
      });
    assert.deepEqual(await colors(), [background, text, border, "1px", glow, gradient, "0"]);
    await install.hover();
    assert.deepEqual(await colors(), [
      background,
      "rgb(255, 255, 255)",
      border,
      "1px",
      glow,
      gradient,
      "1",
    ]);
    await theme.hover();
  };
  const lightFill = "rgb(255, 255, 255)";
  const darkFill = "rgb(16, 18, 22)";
  await theme.locator(".lucide-sun").waitFor();
  await verifyInstallColors(lightFill, "rgb(0, 0, 0)", "rgb(169, 206, 250)");
  await theme.click();
  await theme.locator(".lucide-moon").waitFor();
  await verifyInstallColors(darkFill, "rgb(255, 255, 255)", "rgb(88, 159, 255)");
  await theme.click();
  await theme.locator(".lucide-monitor").waitFor();
  for (const [colorScheme, expected] of [
    ["light", lightFill],
    ["dark", darkFill],
  ]) {
    await page.emulateMedia({ colorScheme });
    await page.waitForFunction(
      (mode) => document.documentElement.dataset.theme === mode,
      colorScheme,
    );
    assert.equal(await fill(), expected);
  }
  await theme.click();
  await theme.locator(".lucide-sun").waitFor();
  const installDialog = page.getByRole("dialog", { name: "Install SilverChat" });
  assert.deepEqual(
    await install.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).cursor]),
    ["rgb(0, 0, 0)", "pointer"],
  );
  await page.emulateMedia({ reducedMotion: null });
  await install.click();
  assert.equal(await installDialog.getByRole("listitem").count(), 3);
  await installDialog.getByText(/Add to Home Screen/).waitFor();
  await page.keyboard.press("Escape");
  await installDialog.waitFor({ state: "hidden" });
  assert.ok(await install.evaluate((el) => document.activeElement === el));
  const offerInstall = async (outcome) =>
    page.evaluate((result) => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      event.prompt = async () => {
        window.installPromptCalls = (window.installPromptCalls || 0) + 1;
        if (result === "error") throw new Error("Unavailable");
      };
      event.userChoice = Promise.resolve({ outcome: result });
      window.dispatchEvent(event);
    }, outcome);
  await offerInstall("dismissed");
  await install.click();
  await installDialog.getByRole("button", { name: "Not now" }).click();
  await install.click();
  await installDialog.getByRole("button", { name: "Install", exact: true }).click();
  await installDialog.waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => window.installPromptCalls), 1);
  for (const outcome of ["error", "accepted"]) {
    await offerInstall(outcome);
    await install.click();
    await installDialog.getByRole("button", { name: "Install", exact: true }).click();
    const notice = page
      .getByRole("status")
      .filter({ hasText: outcome === "error" ? "could not open" : "Installation accepted" });
    await notice.getByRole("button", { name: "Dismiss" }).click();
  }
  await install.waitFor({ state: "hidden" });
  await navigation.getByRole("button", { name: "Log out" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  console.log(
    "PASS batched unread pagination, receipt rendering, request collapse, muted/global badges",
  );
  for (const [name, count] of [
    ["Favorites", 1],
    ["Unread", 4],
    ["Groups", 2],
    ["Archived", 1],
    ["Muted", 1],
    ["Blocked", 0],
    ["All", 6],
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
  await row(101).locator(".draft-pill").waitFor();
  assert.equal(await row(101).locator(".draft-pill").textContent(), "Draft");
  assert.equal(await row(101).locator(".preview-text").textContent(), "Remember the tickets");
  assert.equal(await row(101).locator(".chat-badge").textContent(), "99+");
  assert.equal(await row(101).locator('.chat-name [aria-label="Pin"]').count(), 1);
  // Document preview: single leading file icon, sender prefix, filename, and read receipt.
  assert.equal(await row(102).locator(".chat-preview svg.lucide-file-text").count(), 1);
  assert.equal(await row(102).locator(".preview-text").textContent(), "You: Q4-report.pdf");
  assert.equal(await row(102).locator(".chat-preview .receipt-read").count(), 1);
  // Group photo with caption: single leading image icon, sender prefix, caption only.
  assert.equal(await row(103).locator(".chat-preview svg.lucide-image").count(), 1);
  assert.equal(
    await row(103).locator(".preview-text").textContent(),
    "Nora Bennett: Sunset at the beach",
  );
  // Direct photo without caption: single leading image icon and "Photo" placeholder.
  assert.equal(await row(104).locator(".chat-preview svg.lucide-image").count(), 1);
  assert.equal(await row(104).locator(".preview-text").textContent(), "Photo");
  // Breakpoint consistency: Draft badge and leading media icons render identically at every width.
  let baselinePillStyle = null;
  for (const width of [390, 699, 700, 768, 1023, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const pillStyle = await row(101)
      .locator(".draft-pill")
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          display: s.display,
          fontSize: s.fontSize,
          padding: s.padding,
          borderRadius: s.borderRadius,
          backgroundColor: s.backgroundColor,
          color: s.color,
        };
      });
    assert.equal(
      await row(101).locator(".draft-pill").isVisible(),
      true,
      `Draft pill visible at ${width}px`,
    );
    assert.notEqual(pillStyle.display, "none", `Draft pill rendered at ${width}px`);
    if (!baselinePillStyle) baselinePillStyle = pillStyle;
    else assert.deepEqual(pillStyle, baselinePillStyle, `Draft pill consistent at ${width}px`);
    assert.equal(await row(102).locator(".chat-preview svg.lucide-file-text").isVisible(), true);
    assert.equal(await row(103).locator(".chat-preview svg.lucide-image").isVisible(), true);
  }
  // Theme-aware Draft badge: derives from active accent theme and maintains WCAG AA contrast (>= 4.5:1).
  const accents = ["blue", "orange", "red", "green", "purple", "yellow"];
  for (const mode of ["light", "dark"]) {
    const seenBackgrounds = new Set();
    for (const accent of accents) {
      const result = await row(101)
        .locator(".draft-pill")
        .evaluate(
          (el, { nextMode, nextAccent, allAccents }) => {
            const root = document.documentElement;
            root.dataset.theme = nextMode;
            for (const name of allAccents) root.classList.remove(`theme-${name}`);
            root.classList.add(`theme-${nextAccent}`);
            const s = getComputedStyle(el);
            const toRgb = (value) => {
              const canvas = document.createElement("canvas");
              canvas.width = 1;
              canvas.height = 1;
              const ctx = canvas.getContext("2d");
              ctx.fillStyle = value;
              ctx.fillRect(0, 0, 1, 1);
              return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
            };
            const relLum = ([r, g, b]) =>
              [r, g, b]
                .map((v) => {
                  const n = v / 255;
                  return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
                })
                .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
            const bgRgb = toRgb(s.backgroundColor);
            const fgRgb = toRgb(s.color);
            const l1 = relLum(bgRgb);
            const l2 = relLum(fgRgb);
            const contrast = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
            return { bg: bgRgb.join(","), fg: fgRgb.join(","), contrast };
          },
          { nextMode: mode, nextAccent: accent, allAccents: accents },
        );
      seenBackgrounds.add(result.bg);
      assert.ok(
        result.contrast >= 4.5,
        `Draft pill contrast ${result.contrast.toFixed(2)} < 4.5 in ${mode}/${accent} (bg=${result.bg}, fg=${result.fg})`,
      );
    }
    assert.equal(
      seenBackgrounds.size,
      accents.length,
      `Every accent in ${mode} mode must produce a distinct Draft pill background`,
    );
  }
  await page.evaluate((allAccents) => {
    const root = document.documentElement;
    root.dataset.theme = "light";
    for (const name of allAccents) root.classList.remove(`theme-${name}`);
    root.classList.add("theme-blue");
  }, accents);
  console.log(
    "PASS deduplicated draft/document/photo previews, breakpoint consistency, and theme-aware Draft badge contrast",
  );
  await page
    .locator(".chat-list-item")
    .first()
    .locator(".chat-row-main")
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Select", exact: true }).click();
  const visible = await page
    .locator(".chat-list-item")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-chat-id")));

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
  await page.locator(".request-toggle").click();
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
  // A new community message raises the Communities badge without touching the Chats badge.
  unreadCounts.set(uid(109), 4);
  realtime("messages", { id: uid(209), chat_id: uid(109), sender_id: uid(8) });
  await page.locator('a[href="/communities"]').getByRole("img", { name: "4 Unread" }).waitFor();
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
  await row(102).locator(".chat-row-main").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Select", exact: true }).click();

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
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    const canvas = await page.locator(".conversation-page").boundingBox();
    assert.ok(
      Math.abs(canvas.y + canvas.height - (width < 1024 ? 776 : 844)) <= 1,
      "Conversation canvas clears navigation at every breakpoint",
    );
  }
  const listSearch = page.locator(".chat-list-pane input[type=search]");
  await listSearch.fill("Sofia");
  await page.waitForURL(
    (url) => url.pathname === `/chats/${uid(120)}` && url.searchParams.get("q") === "Sofia",
  );
  await page.locator(".chat-content-pane .conversation-page").waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.app-navigation a[href="/chats"]').click();
  await row(120).waitFor();
  assert.equal(memberships.find((m) => m.chat_id === uid(120)).pinned_at, null);
  assert.deepEqual(errors, []);
  console.log("PASS self-chat creation remains unpinned and opens the conversation composer");
  // Creation screens use the same production hooks after the Step A extraction.
  await page.goto(`${process.env.UI_BASE_URL ?? "http://127.0.0.1:5173"}/chats/new`);
  await page.locator(".new-chat-user-row").filter({ hasText: "Sofia Reyes" }).click();
  await page.waitForURL((url) => url.pathname === `/chats/${uid(101)}`);
  assert.equal(creationCalls.length, 0, "existing contacts do not create duplicate chats");
  await page.goto(`${process.env.UI_BASE_URL ?? "http://127.0.0.1:5173"}/chats/new`);
  await page.getByRole("searchbox").fill("samuel");
  await page
    .getByRole("region", { name: "Search results" })
    .locator(".new-chat-user-row")
    .filter({ hasText: "Samuel Green" })
    .click();
  await page.waitForURL((url) => url.pathname === `/chats/${uid(130)}`);
  assert.deepEqual(creationCalls.at(-1), {
    action: "create_direct_chat_request",
    body: { p_target_user_id: uid(8), p_initial_content: "👋" },
  });
  await page.goto(`${process.env.UI_BASE_URL ?? "http://127.0.0.1:5173"}/chats/new-group`);
  const create = page.getByRole("button", { name: "Create", exact: true });
  assert.equal(await create.isDisabled(), true);
  await page.getByRole("textbox", { name: /Group name/ }).fill("  Review group  ");
  await page.getByRole("checkbox", { name: /Sofia Reyes/ }).check();
  await page.getByRole("button", { name: "Remove Sofia Reyes", exact: true }).click();
  assert.equal(await create.isDisabled(), true);
  await page.getByRole("checkbox", { name: /Sofia Reyes/ }).check();
  failGroupCreation = true;
  await create.click();
  await page.locator(".new-chat-alert").getByText("Creation offline", { exact: true }).waitFor();
  assert.equal(await page.getByRole("checkbox", { name: /Sofia Reyes/ }).isChecked(), true);
  await page
    .locator(".new-chat-alert")
    .getByRole("button", { name: "Dismiss", exact: true })
    .click();
  failGroupCreation = false;
  await create.click();
  await page.waitForURL((url) => url.pathname === `/chats/${uid(140)}`);
  assert.deepEqual(creationCalls.at(-1), {
    action: "create_group_chat",
    body: { p_name: "Review group", p_member_ids: [uid(1)] },
  });
  assert.equal(creationCalls.filter((c) => c.action === "create_group_chat").length, 2);
  assert.deepEqual(errors, []);
  console.log(
    "PASS direct reuse/request and group validation, chip removal, failure/retry, exact RPC arguments and navigation",
  );
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
  await page.goto(`${process.env.UI_BASE_URL ?? "http://127.0.0.1:5173"}/chats`);
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
  assert.equal(await page.locator(".new-chat-fab").getAttribute("data-kind"), "chats");
  assert.equal(
    await page.locator(".new-chat-fab").evaluate((el) => getComputedStyle(el).borderWidth),
    "0px",
  );
  assert.equal(
    await page.locator(".new-chat-fab").evaluate((el) => getComputedStyle(el).outlineStyle),
    "none",
  );
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
