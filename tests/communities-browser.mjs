// Actual React surfaces with mocked BFF/PostgREST/Storage boundaries; no remote writes.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
});
const origin = process.env.TEST_ORIGIN ?? "http://127.0.0.1:5175";
const artifacts = join(tmpdir(), "silverchat-communities");
await mkdir(artifacts, { recursive: true });
const id = (n) => `${String(n).padStart(8, "0")}-4444-4444-8444-444444444444`;
const me = id(1),
  other = id(2),
  third = id(3),
  cid = id(100),
  general = id(101);
const user = {
  id: me,
  email: "alice@example.test",
  aud: "authenticated",
  role: "authenticated",
  user_metadata: {},
  app_metadata: {},
  factors: [],
};
const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: me, aal: "aal2", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
const profiles = [
  {
    id: me,
    username: "alice",
    display_name: "Alice",
    avatar_url: null,
    scheduled_deletion_at: null,
  },
  { id: other, username: "sofia", display_name: "Sofia", avatar_url: null },
  { id: third, username: "carol", display_name: "Carol", avatar_url: null },
];
let community = null,
  chats = [],
  members = [],
  muted = null,
  pinned = null,
  manuallyUnread = false,
  failCreate = false,
  failInfo = false;
const calls = [],
  errors = [],
  uploads = [];
const now = () => new Date().toISOString();
const member = (chatId, userId = me) => ({
  chat_id: chatId,
  user_id: userId,
  role: members.find((m) => m.user_id === userId)?.role ?? "member",
  joined_at: "2026-01-01",
  last_read_at: now(),
  muted_until: muted,
  pinned_at: pinned,
  archived_at: null,
  favorited_at: null,
  manually_unread: manuallyUnread,
});
const chat = (chatId, name) => ({
  id: chatId,
  type: "community_chat",
  status: "active",
  name,
  description: null,
  community_id: cid,
  created_by: me,
  created_at: now(),
  updated_at: now(),
  avatar_url: null,
  direct_pair_key: null,
  last_message_at: null,
  last_message_id: null,
  last_message_preview: null,
  last_message: null,
});
const send = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
async function setup(context) {
  await context.route("**/api/auth/**", (route) =>
    send(route, {
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
      p = url.pathname,
      s = url.searchParams,
      method = req.method();
    const body =
      method === "POST" || method === "PATCH"
        ? (() => {
            try {
              return req.postDataJSON();
            } catch {
              return null;
            }
          })()
        : null;
    const result = (data) =>
      send(route, req.headers().accept?.includes("object") ? (data[0] ?? null) : data);
    if (p.includes("/rpc/")) {
      const rpc = p.split("/").at(-1);
      calls.push({ rpc, body });
      if (rpc === "create_community") {
        if (failCreate) return send(route, { message: "temporary error", code: "P0001" }, 400);
        community = {
          id: cid,
          name: body.p_name,
          description: body.p_description,
          avatar_url: null,
          owner_id: me,
          member_count: 2,
          created_at: now(),
          updated_at: now(),
        };
        members = [
          { community_id: cid, user_id: me, role: "admin", joined_at: "2026-01-01" },
          { community_id: cid, user_id: other, role: "member", joined_at: "2026-01-02" },
        ];
        chats = [chat(general, "General")];
        return send(route, cid);
      }
      if (rpc === "create_community_chat") {
        const next = chat(id(102), body.p_name);
        next.description = body.p_description;
        chats.push(next);
        return send(route, next.id);
      }
      if (rpc === "update_community_info") {
        if (failInfo) return send(route, { message: "denied", code: "42501" }, 403);
        for (const key of ["name", "description", "avatar_url"])
          if (body[`p_${key}`] !== undefined) community[key] = body[`p_${key}`] || null;
        return send(route, null);
      }
      if (rpc === "join_community") {
        if (!members.some((m) => m.user_id === body.p_user_id))
          members.push({
            community_id: cid,
            user_id: body.p_user_id,
            role: "member",
            joined_at: now(),
          });
        community.member_count = members.length;
        return send(route, null);
      }
      if (
        ["promote_community_admin", "demote_community_admin", "remove_community_member"].includes(
          rpc,
        )
      ) {
        if (rpc === "remove_community_member")
          members = members.filter((m) => m.user_id !== body.p_user_id);
        else
          members.find((m) => m.user_id === body.p_user_id).role = rpc.startsWith("promote")
            ? "admin"
            : "member";
        community.member_count = members.length;
        return send(route, null);
      }
      if (rpc === "mute_community") muted = body.p_muted_until;
      if (rpc === "mark_chat_as_unread") manuallyUnread = true;
      if (rpc === "mark_chat_as_read") manuallyUnread = false;
      if (rpc === "delete_community" || rpc === "leave_community") {
        community = null;
        members = [];
        chats = [];
      }
      return send(route, rpc === "get_chat_messages" ? [] : null);
    }
    if (p.endsWith("/user")) return send(route, user);
    if (p.endsWith("/profiles")) return send(route, profiles[0]);
    if (p.endsWith("/user_settings"))
      return send(route, {
        user_id: me,
        theme: "light",
        accent: "blue",
        language: "en",
        read_receipts_enabled: true,
      });
    if (p.endsWith("/profiles_visible"))
      return result(profiles.filter((x) => !s.get("id") || s.get("id").includes(x.id)));
    if (p.endsWith("/communities")) return result(community ? [community] : []);
    if (p.endsWith("/community_members"))
      return result(
        members
          .filter((m) => !s.get("user_id") || s.get("user_id").includes(m.user_id))
          .map((m) => ({ ...m, ...(s.get("select").includes("community:") ? { community } : {}) })),
      );
    if (p.endsWith("/chats"))
      return result(chats.filter((c) => !s.get("id") || s.get("id").includes(c.id)));
    if (p.endsWith("/chat_members")) {
      const chatId = s.get("chat_id")?.slice(3);
      if (method === "PATCH") {
        if ("muted_until" in body) muted = body.muted_until;
        if ("pinned_at" in body) pinned = body.pinned_at;
        return result([{ chat_id: chatId }]);
      }
      if (s.get("select").includes("chat:chats"))
        return result(chats.map((c) => ({ ...member(c.id), chat: c })));
      if (s.get("select") === "chat_id,chats!inner(type,status)") return result([]);
      return result(
        chats
          .filter((c) => !chatId || c.id === chatId)
          .flatMap((c) => members.map((m) => member(c.id, m.user_id))),
      );
    }
    if (p.endsWith("/file_uploads")) {
      if (method === "POST") {
        uploads.push(body);
        return result([body]);
      }
      if (method === "PATCH") {
        Object.assign(
          uploads.find((u) => s.get("id").includes(u.id)),
          body,
        );
        return result([]);
      }
      return result(uploads.filter((u) => !s.get("path") || s.get("path").includes(u.path)));
    }
    if (p.startsWith("/storage/v1/object/sign/"))
      return send(route, { signedURL: "/object/public/test.png" });
    if (p.startsWith("/storage/")) return send(route, { Key: "uploaded" });
    return result([]);
  });
  await context.routeWebSocket("**/realtime/v1/websocket**", (ws) =>
    ws.onMessage((raw) => {
      const msg = JSON.parse(raw);
      ws.send(
        JSON.stringify([
          msg[0],
          msg[1],
          msg[2],
          "phx_reply",
          { status: "ok", response: { postgres_changes: [] } },
        ]),
      );
    }),
  );
}
let diagnosticPage;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setup(context);
  const page = await context.newPage();
  diagnosticPage = page;
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${origin}/communities`);
  await page.getByText("You're not in any communities yet.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "New community", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New community", exact: true });
  await dialog.getByLabel("Name", { exact: true }).fill("Weekend friends");
  await dialog.getByLabel("Description", { exact: true }).fill("Plans together");
  await dialog.getByRole("button", { name: "Choose photo" }).click();
  const picker = page.getByRole("dialog", { name: "Change photo" });
  const image = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 100;
    c.height = 100;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#4488aa";
    ctx.fillRect(0, 0, 100, 100);
    return c.toDataURL("image/png").split(",")[1];
  });
  await picker
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from(image, "base64"),
    });
  await picker.getByRole("slider").waitFor();
  await picker.getByRole("button", { name: "Save", exact: true }).click();
  await dialog.getByRole("button", { name: "Create community", exact: true }).focus();
  await page.keyboard.press("Tab");
  assert.equal(await dialog.locator(":focus").count(), 1, "focus remains in create modal");
  failCreate = true;
  await dialog.getByRole("button", { name: "Create community", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  failCreate = false;
  await dialog.getByRole("button", { name: "Create community", exact: true }).click();
  await page.waitForURL(`**/communities/${cid}`);
  await page.getByText("Select a chat", { exact: true }).waitFor();
  assert.equal(uploads.length, 1);
  assert.match(uploads[0].path, new RegExp(`^community-${cid}/community-`));
  await page
    .getByRole("link", { name: /General/ })
    .first()
    .click();
  await page.locator(".composer-input textarea").waitFor();
  assert.ok(calls.some((c) => c.rpc === "mark_chat_as_read"));
  assert.equal(await page.getByRole("button", { name: /calls coming soon/ }).count(), 0);
  const bounds = await page.locator(".community-layout > div").evaluateAll((els) =>
    els.map((el) => ({
      x: el.getBoundingClientRect().x,
      width: el.getBoundingClientRect().width,
    })),
  );
  assert.equal(bounds[0].width, 320);
  assert.ok(bounds[1].x >= bounds[0].x + 320);
  await page.screenshot({ path: join(artifacts, "desktop.png") });
  await page.getByRole("button", { name: "Chat options", exact: true }).click();
  assert.equal(
    await page
      .getByRole("menuitem", { name: /Add members|View members|Leave group|Block|Report/ })
      .count(),
    0,
  );
  await page.getByRole("menuitem", { name: "Community info", exact: true }).click();
  await page.getByLabel("Community name", { exact: true }).fill("Renamed friends");
  await page.getByRole("textbox", { name: /^Description/ }).click();
  await page.getByRole("heading", { name: "Renamed friends", exact: true }).waitFor();
  await page.getByRole("button", { name: "Add members", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Add members", exact: true })
    .getByRole("searchbox")
    .fill("carol");
  await page.getByRole("checkbox").last().check();
  await page.getByRole("button", { name: "Add 1 members", exact: true }).click();
  assert.ok(calls.some((c) => c.rpc === "join_community" && c.body.p_user_id === third));
  await page.getByRole("button", { name: "View members", exact: true }).click();
  const membersDialog = page.getByRole("dialog", { name: "Community members", exact: true });
  await membersDialog.getByRole("button", { name: "Member actions: Carol" }).click();
  await membersDialog.getByRole("button", { name: "Promote to admin", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Promote Carol?" })
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  assert.ok(calls.some((c) => c.rpc === "promote_community_admin"));
  await membersDialog.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Mute community", exact: true }).click();
  await page.getByRole("button", { name: "8 hours", exact: true }).click();
  await page.getByRole("button", { name: "Unmute community", exact: true }).waitFor();
  assert.ok(muted);
  await page.getByRole("button", { name: "Create chat", exact: true }).click();
  const newChat = page.getByRole("dialog", { name: "New chat", exact: true });
  await newChat.getByLabel("Name", { exact: true }).fill("Announcements");
  await newChat.getByLabel("Description (optional)").fill("News");
  await newChat.getByRole("button", { name: "Create chat", exact: true }).focus();
  await page.keyboard.press("Tab");
  assert.equal(await newChat.locator(":focus").count(), 1);
  await newChat.getByRole("button", { name: "Create chat", exact: true }).click();
  await page.waitForURL(`**/chats/${id(102)}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Back to community", exact: true }).waitFor();
  assert.equal(await page.locator("aside:visible").count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: join(artifacts, "mobile.png") });
  await page.getByRole("link", { name: "Back to community", exact: true }).click();
  await page.getByRole("link", { name: /Announcements/ }).waitFor();
  await page.goto(`${origin}/communities`);
  await page.getByRole("button", { name: /Renamed friends/ }).click();
  await page.getByRole("link", { name: /See all 2 chats/ }).waitFor();
  await page.reload();
  await page.getByRole("link", { name: /See all 2 chats/ }).waitFor();
  await page.getByRole("searchbox").fill("missing");
  await page.getByText("No matching communities.").waitFor();
  members[0].role = "member";
  community.owner_id = other;
  await page.goto(`${origin}/communities/${cid}/info`);
  await page.getByRole("heading", { name: "Renamed friends", exact: true }).waitFor();
  assert.equal(await page.getByLabel("Community name", { exact: true }).count(), 0);
  assert.equal(
    await page.getByRole("button", { name: "Delete community", exact: true }).count(),
    0,
  );
  assert.equal(await page.getByRole("button", { name: "Create chat", exact: true }).count(), 0);
  members[0].role = "admin";
  community.owner_id = me;
  await page.reload();
  await page.getByRole("button", { name: "Leave community", exact: true }).click();
  await page.getByText("You're the owner of this community.", { exact: false }).waitFor();
  await page
    .getByRole("dialog", { name: "Leave community?" })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete community", exact: true }).click();
  const deletion = page.getByRole("dialog", { name: "Delete community?" });
  assert.ok(await deletion.getByRole("button", { name: "Confirm", exact: true }).isDisabled());
  await deletion.getByRole("textbox").fill("Renamed friends");
  await deletion.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.waitForURL("**/communities");
  await page.goto(`${origin}/communities/${cid}`);
  await page.waitForURL("**/communities");
  assert.deepEqual(errors, []);
  console.log(
    "Communities browser checks passed: creation/crop/focus, retries, list/search/persistence, desktop/mobile, messages/menu/read, shared settings/members, mute, admin controls, succession warning, delete and access redirect.",
  );
  console.log(`Screenshots: ${artifacts}`);
  await context.close();
} catch (error) {
  if (diagnosticPage) {
    console.error(await diagnosticPage.locator("body").textContent());
    console.error("Page errors", errors);
    await diagnosticPage.screenshot({ path: join(artifacts, "failure.png") });
  }
  throw error;
} finally {
  await browser.close();
}
