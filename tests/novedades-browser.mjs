// Chromium integration tests with mocked HTTP boundaries; SQL authorization is tested separately.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const clip = (seconds) =>
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `color=c=blue:s=160x120:r=5:d=${seconds}`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "frag_keyframe+empty_moov",
    "-f",
    "mp4",
    "pipe:1",
  ]);
const shortClip = clip(2),
  longClip = clip(16);
const mediaBytes = new Map();
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const uid = (n) => `${String(n).padStart(8, "0")}-3333-4333-8333-333333333333`;
const me = uid(1),
  other = uid(2),
  owned = uid(100),
  followed = uid(101),
  direct = uid(200);
const now = () => new Date().toISOString();
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
    display_name: "Alice",
    avatar_url: null,
    scheduled_deletion_at: null,
  },
  { id: other, username: "sofia", display_name: "Sofia", avatar_url: null },
];
const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: me, aal: "aal2", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
const story = (n, owner = other) => ({
  id: uid(n),
  user_id: owner,
  media_type: "text",
  text_content: `Story ${n}`,
  background_color: "#123456",
  caption: null,
  file_upload_id: null,
  media_thumbnail_upload_id: null,
  created_at: new Date(Date.now() - n * 1000).toISOString(),
  expires_at: new Date(Date.now() + 86400000).toISOString(),
});
let stories = [story(300), story(301)],
  views = [],
  posts = [],
  uploads = [];
const channels = Array.from({ length: 25 }, (_, n) => ({
  id: uid(100 + n),
  owner_id: n === 0 ? me : other,
  name: n === 0 ? "My broadcast" : n === 1 ? "Followed news" : `Discover ${n}`,
  slug: `channel-${n}`,
  description: `Channel description ${n}`,
  follower_count: 100 - n,
  is_verified: n === 1,
  avatar_url: null,
  created_at: now(),
  updated_at: now(),
  last_message_at: now(),
  last_message_preview: "Latest update",
}));
let follows = [owned, followed].map((id) => ({
  channel_id: id,
  user_id: me,
  followed_at: now(),
  last_read_at: "2020-01-01T00:00:00Z",
  muted_until: null,
}));
for (let n = 0; n < 65; n++)
  posts.push({
    id: uid(1000 + n),
    channel_id: followed,
    chat_id: null,
    sender_id: other,
    type: "text",
    content: `Broadcast ${n}`,
    created_at: new Date(Date.now() - (65 - n) * 60000).toISOString(),
    deleted_at: null,
    deleted_for_everyone: false,
    is_pinned_in_chat: false,
    reply_to_message_id: null,
    reply_to_story_id: null,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    mentions: null,
  });
const sockets = new Map();
const reactionRows = [],
  queries = [],
  errors = [];
let failStoryOnce = false,
  storyCalls = [];
const respond = (r, v, status = 200) =>
  r.fulfill({ status, contentType: "application/json", body: JSON.stringify(v) });
async function setup(ctx) {
  await ctx.route("**/api/auth/**", (r) =>
    respond(r, {
      accessToken: jwt,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      user,
      aal: "aal2",
      mfaRequired: false,
    }),
  );
  await ctx.route("https://supabase.test/**", async (r) => {
    const req = r.request(),
      url = new URL(req.url()),
      s = url.searchParams,
      p = url.pathname,
      method = req.method();
    const body =
      ["POST", "PATCH", "DELETE"].includes(method) &&
      req.postData() &&
      req.headers()["content-type"]?.includes("application/json")
        ? req.postDataJSON()
        : {};
    const result = (a) => respond(r, req.headers().accept?.includes("object") ? (a[0] ?? null) : a);
    const filter = (a) =>
      a
        .filter((x) =>
          [...s].every(([k, v]) => !v.startsWith("eq.") || String(x[k]) === v.slice(3)),
        )
        .filter(
          (x) => !s.has("id") || !s.get("id").startsWith("in.") || s.get("id").includes(x.id),
        );
    if (p.endsWith("/user")) return respond(r, user);
    if (p.endsWith("/profiles")) return respond(r, profiles[0]);
    if (p.endsWith("/user_settings"))
      return respond(r, {
        user_id: me,
        theme: "light",
        accent: "blue",
        language: "en",
        read_receipts_enabled: true,
      });
    if (p.endsWith("/profiles_visible")) return result(filter(profiles));
    if (p.endsWith("/app_config")) return result([{ key: "avatar_gradient_palette", value: [] }]);
    if (p.endsWith("/stories"))
      return result(filter(stories).sort((a, b) => a.created_at.localeCompare(b.created_at)));
    if (p.endsWith("/story_views")) return result(views);
    if (p.endsWith("/file_uploads")) {
      if (method === "POST") {
        uploads.push({ id: uid(4000 + uploads.length), ...body });
        return result([uploads.at(-1)]);
      }
      if (method === "PATCH") {
        Object.assign(
          uploads.find((x) => x.id === s.get("id")?.slice(3)),
          body,
        );
        return result(filter(uploads));
      }
      return result(filter(uploads));
    }
    if (p.includes("/storage/v1/object/sign/")) {
      const key = decodeURIComponent(p.split("/object/sign/")[1]);
      if (method === "POST") return respond(r, { signedURL: `/object/sign/${key}?token=fake` });
      const media = mediaBytes.get(key);
      return media
        ? r.fulfill({ status: 200, contentType: media.type, body: media.bytes })
        : r.fulfill({ status: 404 });
    }
    if (p.includes("/storage/v1/object/") && method === "POST") {
      mediaBytes.set(decodeURIComponent(p.split("/object/")[1]), {
        type: req.headers()["content-type"],
        bytes: req.postDataBuffer(),
      });
      return respond(r, { Key: p });
    }
    if (p.includes("/storage/v1/object/")) return respond(r, { Key: "story-media/test" });
    if (p.endsWith("/channels")) {
      if (method === "DELETE") {
        const i = channels.findIndex((x) => x.id === s.get("id").slice(3));
        const [removed] = channels.splice(i, 1);
        follows = follows.filter((f) => f.channel_id !== removed.id);
        posts = posts.filter((m) => m.channel_id !== removed.id);
        return result([removed]);
      }
      return result(
        filter(channels)
          .sort((a, b) => b.follower_count - a.follower_count)
          .slice(
            Number(s.get("offset") ?? 0),
            Number(s.get("offset") ?? 0) + Number(s.get("limit") ?? 100),
          ),
      );
    }
    if (p.endsWith("/channel_followers")) {
      if (method === "PATCH") {
        for (const f of filter(follows)) Object.assign(f, body);
        return result(filter(follows));
      }
      return result(
        filter(follows).map((f) =>
          s.get("select")?.includes("channel:")
            ? { ...f, channel: channels.find((c) => c.id === f.channel_id) }
            : f,
        ),
      );
    }
    if (p.endsWith("/messages")) {
      if (method === "HEAD")
        return r.fulfill({ status: 200, headers: { "content-range": "0-0/120" }, body: "" });
      if (method === "POST") {
        posts.push({ ...body, created_at: now(), deleted_for_everyone: false });
        return result([posts.at(-1)]);
      }
      if (method === "PATCH") {
        for (const m of filter(posts)) Object.assign(m, body);
        return result(filter(posts));
      }
      queries.push(url.toString());
      let a = filter(posts).sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (s.get("or")) {
        const at = s.get("or").match(/created_at.lt.([^,]+)/)?.[1];
        a = a.filter((x) => x.created_at < at);
      }
      return result(a.slice(0, Number(s.get("limit") ?? 1000)));
    }
    if (p.endsWith("/message_reactions")) return result(reactionRows);
    if (p.includes("/rpc/")) {
      const fn = p.split("/").at(-1);
      if (fn === "create_story") {
        storyCalls.push(body.p_story_id);
        if (!stories.some((x) => x.id === body.p_story_id))
          stories.push({
            ...story(500, me),
            id: body.p_story_id,
            media_type: body.p_media_type,
            text_content: body.p_text_content,
            background_color: body.p_background_color,
            file_upload_id: body.p_file_upload_id ?? null,
            media_thumbnail_upload_id: body.p_thumbnail_upload_id ?? null,
            caption: body.p_caption ?? null,
          });
        if (failStoryOnce) {
          failStoryOnce = false;
          return respond(r, { message: "Temporary response failure" }, 503);
        }
        return respond(r, body.p_story_id);
      }
      if (fn === "mark_story_viewed") {
        if (!views.some((v) => v.story_id === body.p_story_id))
          views.push({ story_id: body.p_story_id, viewer_id: me });
        return respond(r, null);
      }
      if (fn === "get_story_viewers")
        return respond(r, [{ viewer_id: other, ...profiles[1], viewed_at: now() }]);
      if (fn === "delete_story") {
        stories = stories.filter((x) => x.id !== body.p_story_id);
        return respond(r, null);
      }
      if (fn === "create_direct_chat_request") return respond(r, direct);
      if (fn === "follow_channel") {
        if (!follows.some((x) => x.channel_id === body.p_channel_id))
          follows.push({
            channel_id: body.p_channel_id,
            user_id: me,
            last_read_at: now(),
            muted_until: null,
          });
        return respond(r, null);
      }
      if (fn === "unfollow_channel") {
        follows = follows.filter((x) => x.channel_id !== body.p_channel_id);
        return respond(r, null);
      }
      if (fn === "set_message_reaction") {
        reactionRows.splice(0, reactionRows.length, {
          message_id: body.p_message_id,
          user_id: me,
          emoji: body.p_emoji,
        });
        return respond(r, null);
      }
      if (fn === "create_channel") {
        const c = {
          ...channels[0],
          id: uid(999),
          name: body.p_name,
          slug: body.p_slug,
          description: body.p_description,
        };
        channels.push(c);
        follows.push({ channel_id: c.id, user_id: me, last_read_at: now(), muted_until: null });
        return respond(r, c.id);
      }
      if (fn === "update_channel_info") {
        const c = channels.find((x) => x.id === body.p_channel_id);
        for (const k of ["name", "slug", "description", "avatar_url"])
          if (body[`p_${k}`] != null) c[k] = body[`p_${k}`];
        return respond(r, null);
      }
      if (fn === "own_upload_is_referenced") return respond(r, true);
      return respond(r, []);
    }
    return result([]);
  });
  await ctx.routeWebSocket("**/realtime/v1/websocket*", (socket) =>
    socket.onMessage((raw) => {
      const [join, ref, topic, event, payload] = JSON.parse(String(raw));
      if (event === "phx_join") {
        const config = (payload.config.postgres_changes ?? []).map((c, i) => ({ ...c, id: i + 1 }));
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
      if (event === "heartbeat")
        socket.send(
          JSON.stringify([join, ref, topic, "phx_reply", { status: "ok", response: {} }]),
        );
    }),
  );
  ctx.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
}
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await setup(ctx);
const page = await ctx.newPage();
page.setDefaultTimeout(10000);
const goto = (path) => page.goto(`http://127.0.0.1:5173${path}`);
try {
  await goto("/novedades");
  await page.getByRole("button", { name: "My story", exact: true }).waitFor();
  await page.locator(".discover-channel").first().waitFor();
  assert.equal(await page.locator(".discover-channel").count(), 20);
  await page.getByRole("button", { name: "Sofia", exact: true }).click();
  await page.locator(".story-stage").getByText("Story 301", { exact: true }).waitFor();
  const stage = await page.locator(".story-stage").boundingBox();
  await page.mouse.move(stage.x + 50, stage.y + 50);
  await page.mouse.down();
  await page.waitForTimeout(5300);
  assert.equal(await page.locator(".story-stage").textContent(), "Story 301");
  await page.mouse.up();
  await page
    .locator(".story-stage")
    .getByText("Story 300", { exact: true })
    .waitFor({ timeout: 7000 });
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByRole("textbox", { name: "Reply to story" }).fill("Nice story");
  await page.locator(".story-reply").getByRole("button", { name: "Send", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector(".story-reply input")?.value);
  assert.ok(
    posts.some(
      (x) => x.chat_id === direct && x.reply_to_story_id === uid(301) && x.content === "Nice story",
    ),
  );
  assert.equal(views.filter((v) => v.story_id === uid(301)).length, 1);
  await page.getByRole("button", { name: "Close story", exact: true }).click();
  await page.getByRole("button", { name: "My story", exact: true }).click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  assert.equal(await page.locator(".story-colors button").count(), 8);
  await page.getByRole("textbox", { name: "Story text" }).fill("My first text story");
  failStoryOnce = true;
  await page.getByRole("button", { name: "Send story" }).click();
  await page.getByRole("alert").waitFor();
  await page.getByRole("button", { name: "Send story" }).click();
  await page
    .getByRole("dialog", { name: "Create story", exact: true })
    .waitFor({ state: "detached" });
  assert.equal(storyCalls.at(-1), storyCalls.at(-2));
  assert.equal(stories.filter((x) => x.user_id === me).length, 1);
  await page.getByRole("button", { name: "My story", exact: true }).click();
  await page.getByRole("button", { name: /1 views/ }).click();
  await page.getByRole("dialog", { name: "Viewed by 1" }).waitFor();
  await page
    .getByRole("dialog", { name: "Viewed by 1" })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByRole("button", { name: "Story options" }).click();
  await page.getByRole("button", { name: "Delete story", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Delete this story?" })
    .getByRole("button", { name: "Delete story", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Story", exact: true }).waitFor({ state: "detached" });
  assert.equal(stories.filter((x) => x.user_id === me).length, 0);
  // Real compression, video decoding, duration rejection, tracked uploads and playback.
  await page.getByRole("button", { name: "My story", exact: true }).click();
  await page.getByRole("button", { name: "Gallery", exact: true }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "long.mp4", mimeType: "video/mp4", buffer: longClip });
  await page.getByRole("alert").filter({ hasText: "at most 15 seconds" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Send story" }).isDisabled(), true);
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "short.mp4", mimeType: "video/mp4", buffer: shortClip });
  await page.getByLabel("Caption", { exact: true }).fill("Video caption below");
  await page.getByRole("button", { name: "Send story" }).click();
  await page
    .getByRole("dialog", { name: "Create story", exact: true })
    .waitFor({ state: "detached" });
  const videoStory = stories.find((x) => x.user_id === me);
  assert.ok(videoStory.media_thumbnail_upload_id);
  assert.ok(uploads.find((x) => x.id === videoStory.file_upload_id).duration_seconds <= 3);
  assert.ok(uploads.every((x) => x.bucket === "story-media" && x.path.startsWith(`${me}/`)));
  await page.getByRole("button", { name: "My story", exact: true }).click();
  await page.locator(".story-stage video").waitFor();
  if (await page.getByRole("button", { name: "Play video", exact: true }).isVisible())
    await page.getByRole("button", { name: "Play video", exact: true }).click();
  await page
    .locator(".story-stage")
    .getByText("Story 301", { exact: true })
    .waitFor({ timeout: 6000 });
  await page.getByRole("button", { name: "Close story", exact: true }).click();
  await page.getByRole("button", { name: "Add story", exact: true }).click();
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 400;
    const g = c.getContext("2d");
    g.fillStyle = "#0088ff";
    g.fillRect(0, 0, 600, 400);
    return c.toDataURL().split(",")[1];
  });
  await page.locator("input[type=file]").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await page.getByLabel("Caption", { exact: true }).fill("Photo caption below");
  await page.getByRole("button", { name: "Send story" }).click();
  await page
    .getByRole("dialog", { name: "Create story", exact: true })
    .waitFor({ state: "detached" });
  assert.equal(uploads.at(-1).mime_type, "image/webp");
  assert.ok(uploads.at(-1).size_bytes < 200000);
  assert.equal(stories.filter((x) => x.user_id === me).length, 2);
  const discovered = page.locator(".discover-channel").first();
  const discoveredName = await discovered.locator("strong").textContent();
  await discovered.getByRole("button", { name: "Follow", exact: true }).click();
  await page.locator(".channel-list-item").filter({ hasText: discoveredName }).waitFor();
  await goto(`/channels/${followed}`);
  await page.getByText("Broadcast 64", { exact: true }).waitFor();
  assert.equal(await page.locator(".conversation-composer").count(), 0);
  const live = { ...posts[0], id: uid(1900), content: "Realtime broadcast", created_at: now() };
  posts.push(live);
  for (const [topic, { socket, config }] of sockets) {
    const ids = config
      .filter((c) => c.table === "messages" && c.filter === `channel_id=eq.${followed}`)
      .map((c) => c.id);
    if (ids.length)
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
              table: "messages",
              type: "INSERT",
              record: live,
              old_record: {},
              errors: null,
              columns: Object.keys(live).map((name) => ({ name, type: "text" })),
              commit_timestamp: now(),
            },
          },
        ]),
      );
  }
  await page.getByText("Realtime broadcast", { exact: true }).waitFor({ timeout: 5000 });
  await page.locator(".message-list").evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event("scroll"));
  });
  await page.getByText("Broadcast 0", { exact: true }).waitFor();
  assert.ok(queries.some((q) => q.includes("or=")));
  await page
    .locator("[data-message-id]")
    .last()
    .locator(".message-bubble")
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "React", exact: true }).click();
  assert.equal(await page.locator(".quick-reactions button").count(), 8);
  assert.equal(await page.getByRole("button", { name: "More emoji" }).count(), 0);
  await page.getByRole("button", { name: "👍", exact: true }).click();
  await page.getByRole("button", { name: "Channel options" }).click();
  await page.getByRole("button", { name: "Mute notifications", exact: true }).click();
  await page.getByRole("button", { name: "Always", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.ok(follows.find((x) => x.channel_id === followed).muted_until.startsWith("9999"));
  await goto(`/channels/${owned}`);
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Owner broadcast");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByText("Owner broadcast", { exact: true }).waitFor();
  assert.ok(posts.some((x) => x.channel_id === owned && x.chat_id == null));
  await goto(`/channels/${owned}/info`);
  await page.getByRole("button", { name: "Edit channel", exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Updated broadcast");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("heading", { name: "Updated broadcast", exact: true }).waitFor();
  await goto("/novedades");
  await page.getByRole("button", { name: "Create channel", exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Café Announcements");
  assert.equal(
    await page.getByRole("textbox", { name: "Slug", exact: true }).inputValue(),
    "cafe-announcements",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create channel", exact: true })
    .click();
  await page.waitForURL(`**/channels/${uid(999)}/info`);
  await page.getByRole("button", { name: "Delete channel", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete channel", exact: true })
    .click();
  await page.waitForURL("**/novedades");
  await page.screenshot({ path: "/workspace/novedades-desktop.png", fullPage: true });
  await page.getByRole("link", { name: /Explore more/ }).click();
  await page.waitForURL("**/novedades/explore");
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await setup(mobile);
  const mp = await mobile.newPage();
  await mp.goto("http://127.0.0.1:5173/novedades");
  await mp.getByRole("button", { name: "My story", exact: true }).waitFor();
  await mp.locator(".channel-list-item").first().waitFor();
  assert.ok(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mp.screenshot({ path: "/workspace/novedades-mobile.png", fullPage: true });
  await mp.getByRole("button", { name: "Sofia", exact: true }).click();
  const swipe = await mp.locator(".story-stage").boundingBox();
  await mp.mouse.move(swipe.x + swipe.width / 2, swipe.y + 30);
  await mp.mouse.down();
  await mp.mouse.move(swipe.x + swipe.width / 2, swipe.y + 160, { steps: 8 });
  await mp.mouse.up();
  await mp.getByRole("dialog", { name: "Story", exact: true }).waitFor({ state: "detached" });
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: stories text/image/video uploads, duration rejection/playback, ordering/timer/hold/navigation/reply/idempotent creation/viewers/delete; discover top20/follow; channel Realtime/paging/read-only/react8/mute/owner composer/edit/create/delete; explore; mobile layout.",
  );
} catch (e) {
  await page.screenshot({ path: "/workspace/novedades-failure.png", fullPage: true });
  console.error(await page.locator("body").textContent());
  throw e;
} finally {
  await browser.close();
}
