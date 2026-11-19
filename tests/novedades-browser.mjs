// Chromium integration tests with mocked HTTP boundaries; SQL authorization is tested separately.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { launchBrowser } from "./lib/browser.mjs";

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
const mediaBytes = new Map([
  [
    "avatars/sofia.svg",
    {
      type: "image/svg+xml",
      bytes: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#38bdf8"/></svg>',
      ),
    },
  ],
]);

const browser = await launchBrowser({ args: ["--no-sandbox"] });

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
  {
    id: other,
    username: "sofia",
    display_name: "Sofia",
    avatar_url: "sofia.svg",
  },
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
let failChannelRead = false,
  failChannelSlug = false,
  failChannelAvatar = false,
  channelCreates = 0;
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
let failReplyOnce = false,
  failReplyLookupOnce = false,
  directRequests = 0;
const replyAttempts = [];
let userSettings = {
  user_id: me,
  theme: "light",
  accent: "blue",
  language: "en",
  read_receipts_enabled: true,
};
let failStoryOnce = false,
  storyCalls = [];
const respond = (r, v, status = 200) =>
  r.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(v),
  });
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
    if (p.endsWith("/user_settings")) {
      if (method === "PATCH" || method === "POST") {
        userSettings = { ...userSettings, ...body };
      }
      return respond(r, userSettings);
    }
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
      if (failChannelSlug && s.has("slug"))
        return respond(r, { message: "Availability unavailable" }, 500);
      if (method === "DELETE") {
        assert.equal(s.get("owner_id"), `eq.${me}`);
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
        assert.equal(s.get("user_id"), `eq.${me}`);
        if (failChannelRead && body.last_read_at)
          return respond(r, { message: "Cursor unavailable" }, 500);
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
        return r.fulfill({
          status: 200,
          headers: { "content-range": "0-0/120" },
          body: "",
        });
      if (method === "POST") {
        if (body.reply_to_story_id) {
          replyAttempts.push(body.id);
          if (posts.some((post) => post.id === body.id))
            return respond(r, { message: "Duplicate id" }, 409);
        }
        posts.push({ ...body, created_at: now(), deleted_for_everyone: false });
        if (body.reply_to_story_id && failReplyOnce) {
          failReplyOnce = false;
          return respond(r, { message: "Ambiguous response" }, 400);
        }
        return result([posts.at(-1)]);
      }
      if (method === "PATCH") {
        for (const m of filter(posts)) Object.assign(m, body);
        return result(filter(posts));
      }
      if (s.get("select") === "id" && failReplyLookupOnce) {
        failReplyLookupOnce = false;
        return respond(r, { message: "Reconciliation offline" }, 400);
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
      if (fn === "create_direct_chat_request") {
        directRequests++;
        return respond(r, direct);
      }
      if (fn === "follow_channel") {
        if (!follows.some((x) => x.channel_id === body.p_channel_id)) {
          follows.push({
            channel_id: body.p_channel_id,
            user_id: me,
            last_read_at: now(),
            muted_until: null,
          });
          const ch = channels.find((x) => x.id === body.p_channel_id);
          if (ch) ch.follower_count += 1;
        }
        return respond(r, null);
      }
      if (fn === "unfollow_channel") {
        const before = follows.length;
        follows = follows.filter((x) => x.channel_id !== body.p_channel_id);
        if (follows.length < before) {
          const ch = channels.find((x) => x.id === body.p_channel_id);
          if (ch) ch.follower_count = Math.max(0, ch.follower_count - 1);
        }
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
        channelCreates++;
        const c = {
          ...channels[0],
          id: uid(999),
          name: body.p_name,
          slug: body.p_slug,
          description: body.p_description,
        };
        channels.push(c);
        follows.push({
          channel_id: c.id,
          user_id: me,
          last_read_at: now(),
          muted_until: null,
        });
        return respond(r, c.id);
      }
      if (fn === "update_channel_info") {
        if (failChannelAvatar && body.p_avatar_url)
          return respond(r, { message: "Avatar update unavailable" }, 500);
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
      if (event === "heartbeat")
        socket.send(
          JSON.stringify([join, ref, topic, "phx_reply", { status: "ok", response: {} }]),
        );
    }),
  );
  ctx.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
}
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
await setup(ctx);
const page = await ctx.newPage();
page.setDefaultTimeout(10000);
const baseUrl = process.env.TEST_BASE_URL ?? "http://127.0.0.1:5173";
const goto = (path) => page.goto(`${baseUrl}${path}`);
const cycleFocus = async (dialog, targetPage = page) => {
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let i = 0; i < 20; i++) {
      await targetPage.keyboard.press(key);
      assert.ok(
        await dialog.evaluate((el) => document.activeElement?.closest("dialog") === el),
        `${key} escaped the dialog`,
      );
    }
  }
};
const assertStoryViewerLayout = async (targetPage) => {
  const headerAvatar = targetPage.locator('.story-viewer-header [data-slot="avatar"]');
  await headerAvatar.waitFor();
  const headerImg = headerAvatar.locator("img");
  await headerImg.waitFor();
  const avatarBox = await headerAvatar.boundingBox();
  const imgBox = await headerImg.boundingBox();
  const avatarClient = await headerAvatar.evaluate((el) => ({
    width: el.clientWidth,
    height: el.clientHeight,
  }));
  assert.ok(avatarBox && imgBox, "Story viewer header avatar and image must render");
  assert.ok(
    Math.abs(avatarBox.width - avatarBox.height) <= 0.5 && avatarBox.width >= 36,
    `Header avatar must be circular, got ${avatarBox.width}x${avatarBox.height}`,
  );
  assert.ok(
    Math.abs(imgBox.width - avatarClient.width) <= 1 &&
      Math.abs(imgBox.height - avatarClient.height) <= 1,
    `Header avatar image must fill container content box, got ${imgBox.width}x${imgBox.height} in ${avatarClient.width}x${avatarClient.height}`,
  );
  const avatarStyle = await headerAvatar.evaluate((el) => {
    const s = getComputedStyle(el);
    const img = el.querySelector("img");
    const is = img ? getComputedStyle(img) : null;
    return {
      borderRadius: s.borderRadius,
      overflow: s.overflow,
      objectFit: is?.objectFit,
      objectPosition: is?.objectPosition,
    };
  });
  assert.equal(avatarStyle.overflow, "hidden");
  assert.equal(avatarStyle.objectFit, "cover");
  assert.equal(avatarStyle.objectPosition, "50% 50%");
  assert.ok(
    avatarStyle.borderRadius === "50%" ||
      Number.parseFloat(avatarStyle.borderRadius) >= avatarBox.width / 2 - 0.5,
    `Expected circular border-radius, got ${avatarStyle.borderRadius}`,
  );

  const replyForm = targetPage.locator(".story-reply");
  const replyInput = replyForm.locator("input");
  const replySend = replyForm.locator(".story-send");
  const [formStyle, sendStyle, inputBox, sendBox] = await Promise.all([
    replyForm.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        display: s.display,
        flexDirection: s.flexDirection,
        alignItems: s.alignItems,
      };
    }),
    replySend.evaluate((el) => ({
      borderRadius: getComputedStyle(el).borderRadius,
    })),
    replyInput.boundingBox(),
    replySend.boundingBox(),
  ]);
  assert.equal(formStyle.display, "flex");
  assert.equal(formStyle.flexDirection, "row");
  assert.equal(formStyle.alignItems, "center");
  assert.ok(inputBox && sendBox, "Reply input and send button must render");
  assert.ok(
    inputBox.x + inputBox.width <= sendBox.x + 1,
    `Send button must sit to the right of input (input right=${inputBox.x + inputBox.width}, send left=${sendBox.x})`,
  );
  assert.ok(
    Math.abs(inputBox.y + inputBox.height / 2 - (sendBox.y + sendBox.height / 2)) <= 2,
    `Input and send button must align on one horizontal row (input cy=${inputBox.y + inputBox.height / 2}, send cy=${sendBox.y + sendBox.height / 2})`,
  );
  assert.ok(
    inputBox.width > sendBox.width * 2,
    `Reply input should fill available horizontal space, got ${inputBox.width}px`,
  );
  assert.ok(
    Math.abs(sendBox.width - sendBox.height) <= 0.5 && sendBox.width >= 44,
    `Send button must be a >=44px circle, got ${sendBox.width}x${sendBox.height}`,
  );
  assert.ok(
    sendStyle.borderRadius === "50%" ||
      Number.parseFloat(sendStyle.borderRadius) >= sendBox.width / 2 - 0.5,
    `Expected circular send button border-radius, got ${sendStyle.borderRadius}`,
  );
};
try {
  await goto("/novedades");
  await page.getByRole("button", { name: "My story", exact: true }).waitFor();
  await page.locator(".discover-channel").first().waitFor();
  assert.equal(await page.locator(".discover-channel").count(), 20);
  await page.getByRole("button", { name: "Sofia", exact: true }).click();
  await page.locator(".story-stage").getByText("Story 301", { exact: true }).waitFor();
  await assertStoryViewerLayout(page);
  const stage = await page.locator(".story-stage").boundingBox();
  await page.mouse.move(stage.x + 50, stage.y + 50);
  await page.mouse.down();
  await page.waitForTimeout(100);
  const heldProgress = await page.locator(".story-progress").innerHTML();
  await page.waitForTimeout(5300);
  assert.equal(await page.locator(".story-progress").innerHTML(), heldProgress);
  assert.equal(await page.locator(".story-stage").textContent(), "Story 301");
  await page.mouse.up();
  await page
    .locator(".story-stage")
    .getByText("Story 300", { exact: true })
    .waitFor({ timeout: 7000 });
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByRole("textbox", { name: "Reply to story" }).fill("Nice story");
  failReplyOnce = true;
  failReplyLookupOnce = true;
  await page.locator(".story-reply").getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Reply failed" }).waitFor();
  await assertStoryViewerLayout(page);
  const replyPaused = await page.locator(".story-progress").innerHTML();
  await page.waitForTimeout(250);
  assert.equal(await page.locator(".story-progress").innerHTML(), replyPaused);
  await page.locator(".story-reply").getByRole("button", { name: "Send", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector(".story-reply input")?.value);
  assert.ok(
    posts.some(
      (x) => x.chat_id === direct && x.reply_to_story_id === uid(301) && x.content === "Nice story",
    ),
  );
  assert.equal(directRequests, 1);
  assert.equal(replyAttempts.length, 2);
  assert.equal(replyAttempts[0], replyAttempts[1]);
  assert.equal(posts.filter((post) => post.reply_to_story_id === uid(301)).length, 1);
  assert.equal(views.filter((v) => v.story_id === uid(301)).length, 1);
  await page.getByRole("button", { name: "Close story", exact: true }).click();
  await page.getByRole("button", { name: "My story", exact: true }).click();
  await cycleFocus(page.getByRole("dialog", { name: "Create story", exact: true }));
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: "Create story", exact: true })
    .waitFor({ state: "detached" });
  assert.ok(
    await page
      .getByRole("button", { name: "My story", exact: true })
      .evaluate((el) => el === document.activeElement),
  );
  await page.getByRole("button", { name: "My story", exact: true }).click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await cycleFocus(page.getByRole("dialog", { name: "Create story", exact: true }));
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
  await cycleFocus(page.getByRole("dialog", { name: "Viewed by 1" }));
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Viewed by 1" }).waitFor({ state: "detached" });
  assert.ok(
    await page
      .getByRole("button", { name: /1 views/ })
      .evaluate((el) => el === document.activeElement),
  );
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
  await page.locator("input[type=file]").setInputFiles({
    name: "long.mp4",
    mimeType: "video/mp4",
    buffer: longClip,
  });
  await page.getByRole("alert").filter({ hasText: "at most 15 seconds" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Send story" }).isDisabled(), true);
  await page.locator("input[type=file]").setInputFiles({
    name: "short.mp4",
    mimeType: "video/mp4",
    buffer: shortClip,
  });
  await page.getByLabel("Caption", { exact: true }).fill("Video caption below");
  failStoryOnce = true;
  await page.getByRole("button", { name: "Send story" }).click();
  await page.getByRole("alert").filter({ hasText: "Unable to publish story" }).waitFor();
  const uploadedBeforeRetry = uploads.map((upload) => upload.id);
  assert.equal(await page.locator(".story-creator textarea").isDisabled(), true);
  await page.getByRole("button", { name: "Send story" }).click();
  await page
    .getByRole("dialog", { name: "Create story", exact: true })
    .waitFor({ state: "detached" });
  assert.deepEqual(
    uploads.map((upload) => upload.id),
    uploadedBeforeRetry,
  );
  assert.equal(storyCalls.at(-1), storyCalls.at(-2));
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
  failChannelRead = true;
  await goto(`/channels/${followed}`);
  await page.getByRole("button", { name: /Retry marking channel read/ }).waitFor();
  failChannelRead = false;
  await page.getByRole("button", { name: /Retry marking channel read/ }).click();
  await page
    .getByRole("button", { name: /Retry marking channel read/ })
    .waitFor({ state: "detached" });
  await page.getByText("Broadcast 64", { exact: true }).waitFor();
  assert.equal(await page.locator(".conversation-composer").count(), 0);
  const live = {
    ...posts[0],
    id: uid(1900),
    content: "Realtime broadcast",
    created_at: now(),
  };
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
              columns: Object.keys(live).map((name) => ({
                name,
                type: "text",
              })),
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
  assert.equal(await page.locator(".chat-options-menu [role=menuitem]").count(), 6);
  await page.getByRole("menuitem", { name: "Search in chat", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search in conversation" }).fill("Broadcast 64");
  await page.locator(".in-chat-search [role=status]").getByText("1/1", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Close search", exact: true }).click();
  await page.getByRole("button", { name: "Channel options" }).click();
  await page.getByRole("menuitem", { name: /^Mute/ }).click();
  const muteStart = Date.now();
  await page.getByRole("button", { name: "8 hours", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.ok(
    Math.abs(
      Date.parse(follows.find((x) => x.channel_id === followed).muted_until) -
        muteStart -
        8 * 3600000,
    ) < 5000,
  );
  await page.getByRole("button", { name: "Channel options" }).click();
  await page.getByRole("menuitem", { name: /^Mute/ }).click();
  assert.ok(await page.getByRole("button", { name: "Unmute", exact: true }).isVisible());
  await page.getByRole("button", { name: "Always", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.ok(follows.find((x) => x.channel_id === followed).muted_until.startsWith("9999"));
  await page.getByRole("button", { name: "Channel options" }).click();
  await page.getByRole("menuitem", { name: /^Mute/ }).click();
  await page.getByRole("button", { name: "Unmute", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal(follows.find((x) => x.channel_id === followed).muted_until, null);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Channel options" }).click();
  await page.getByRole("menuitem", { name: "Copy channel link", exact: true }).click();
  await page.waitForFunction(
    async (expected) => (await navigator.clipboard.readText()) === expected,
    `${baseUrl}/channels/${followed}`,
  );
  await page.getByRole("button", { name: "Channel options" }).click();
  await page.getByRole("menuitem", { name: "Mark as unread", exact: true }).click();
  await page.waitForURL("**/novedades");
  assert.equal(
    Date.parse(follows.find((x) => x.channel_id === followed).last_read_at),
    Date.parse(channels.find((x) => x.id === followed).last_message_at) - 1,
  );
  await goto(`/channels/${followed}/info`);
  await page.locator(".channel-profile").waitFor();
  assert.equal(await page.getByRole("button", { name: "Edit channel", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Delete channel", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Channel options" }).click();
  await page.getByRole("menuitem", { name: "Search in chat", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search in conversation" }).waitFor();
  await page.getByRole("button", { name: "Close search", exact: true }).click();
  await page.getByRole("button", { name: "Channel options" }).click();
  await page.getByRole("menuitem", { name: "Unfollow", exact: true }).click();
  await page.getByRole("button", { name: "Follow channel", exact: true }).waitFor();
  assert.equal(await page.getByText("Follow this channel to see its posts.").count(), 0);
  // Posts remain readable even when not following the channel.
  await page.getByText("Broadcast 64", { exact: true }).waitFor();
  await page.locator(".channel-header small").filter({ hasText: "98 followers" }).waitFor();
  // Scroll up to the start of history and verify shared + creation pills while unfollowed.
  await page.locator(".message-list").evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.locator('[data-slot="conversation-start-pill"]').waitFor();
  assert.equal(
    await page.locator('[data-slot="conversation-start-pill"]').textContent(),
    "Start of this conversation",
  );
  assert.equal(
    await page.locator('[data-slot="conversation-encryption-pill"]').textContent(),
    "Messages are end-to-end encrypted. No one outside of this chat can read or listen to them.",
  );
  const followedCreatedText = await page
    .locator('[data-slot="channel-created-pill"]')
    .textContent();
  assert.equal(followedCreatedText, 'Channel "Followed news" was created');
  assert.ok(!/sofia/i.test(followedCreatedText ?? ""), "Creator identity must never appear");
  // Click bottom CTA: optimistic + persisted follow, header count updates, CTA disappears.
  await page.getByRole("button", { name: "Follow channel", exact: true }).click();
  await page
    .getByRole("button", { name: "Follow channel", exact: true })
    .waitFor({ state: "detached" });
  await page.locator(".channel-header small").filter({ hasText: "99 followers" }).waitFor();
  await page.reload();
  await page.getByText("Broadcast 64", { exact: true }).waitFor();
  await page.locator(".channel-header small").filter({ hasText: "99 followers" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Follow channel", exact: true }).count(), 0);
  // Unfollowing via overflow menu restores CTA; re-following via menu removes it again.
  await page.getByRole("button", { name: "Channel options" }).click();
  await page.getByRole("menuitem", { name: "Unfollow", exact: true }).click();
  await page.getByRole("button", { name: "Follow channel", exact: true }).waitFor();
  await page.locator(".channel-header small").filter({ hasText: "98 followers" }).waitFor();
  await page.getByRole("button", { name: "Channel options" }).click();
  await page.getByRole("menuitem", { name: "Follow", exact: true }).click();
  await page
    .getByRole("button", { name: "Follow channel", exact: true })
    .waitFor({ state: "detached" });
  await page.getByText("Broadcast 64", { exact: true }).waitFor();
  // Verify empty, unfollowed channel: doodle canvas, 3 centered pills, no creator info, pinned CTA, themes & contrast, i18n.
  const emptyUnfollowed = uid(103);
  await goto(`/channels/${emptyUnfollowed}`);
  await page.locator('[data-slot="conversation-shell"]').waitFor();
  await page.locator('[data-slot="chat-doodle-pattern"]').waitFor();
  assert.equal(
    await page.locator('[data-slot="conversation-start-pill"]').textContent(),
    "Start of this conversation",
  );
  assert.equal(
    await page.locator('[data-slot="conversation-encryption-pill"]').textContent(),
    "Messages are end-to-end encrypted. No one outside of this chat can read or listen to them.",
  );
  const emptyCreatedText = await page.locator('[data-slot="channel-created-pill"]').textContent();
  assert.equal(emptyCreatedText, 'Channel "Discover 3" was created');
  assert.ok(!/sofia/i.test(emptyCreatedText ?? ""), "Creator identity must never appear");
  assert.equal(await page.getByText("Follow this channel to see its posts.").count(), 0);
  const cta = page.locator('[data-slot="channel-follow-cta"]');
  await cta.waitFor();
  const [headerBox, canvasBox, ctaBox] = await Promise.all([
    page.locator('[data-slot="conversation-shell-header"]').boundingBox(),
    page.locator('[data-slot="conversation-canvas"]').boundingBox(),
    cta.boundingBox(),
  ]);
  assert.ok(headerBox && canvasBox && ctaBox);
  assert.ok(
    ctaBox.y >= canvasBox.y + canvasBox.height,
    "Follow CTA is pinned below scrolling canvas",
  );
  assert.ok(ctaBox.width >= 300, "Follow CTA stretches cleanly across the bottom bar");
  // Check live contrast & theme adaptation across light/dark x all 6 accent themes.
  const themeAudit = await page.evaluate(() => {
    const parseColor = (cssColor) => {
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.fillStyle = cssColor;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b];
    };
    const lum = ([r, g, b]) =>
      [r, g, b]
        .map((c) => {
          const v = c / 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        })
        .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (c1, c2) => {
      const l1 = lum(c1),
        l2 = lum(c2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const root = document.documentElement;
    const prevTheme = root.dataset.theme;
    const prevClass = root.className;
    const results = [];
    for (const mode of ["light", "dark"]) {
      root.dataset.theme = mode;
      for (const accent of ["blue", "purple", "red", "orange", "yellow", "green"]) {
        for (const a of ["blue", "purple", "red", "orange", "yellow", "green"])
          root.classList.remove(`theme-${a}`);
        root.classList.add(`theme-${accent}`);
        const ctaEl = document.querySelector('[data-slot="channel-follow-cta"]');
        const pillEl = document.querySelector(".system-pill");
        const doodleEl = document.querySelector('[data-slot="chat-doodle-pattern"]');
        const ctaStyle = getComputedStyle(ctaEl);
        const pillStyle = getComputedStyle(pillEl);
        const doodleStyle = getComputedStyle(doodleEl);
        results.push({
          mode,
          accent,
          ctaContrast: ratio(parseColor(ctaStyle.backgroundColor), parseColor(ctaStyle.color)),
          pillContrast: ratio(parseColor(pillStyle.backgroundColor), parseColor(pillStyle.color)),
          ctaBg: ctaStyle.backgroundColor,
          ctaFg: ctaStyle.color,
          doodleColor: doodleStyle.color,
        });
      }
    }
    root.dataset.theme = prevTheme;
    root.className = prevClass;
    return results;
  });
  for (const r of themeAudit) {
    assert.ok(
      r.pillContrast >= 4.5,
      `Pill contrast too low in ${r.mode}/${r.accent}: ${r.pillContrast.toFixed(2)}`,
    );
    if (r.mode === "light" && r.accent !== "yellow") {
      assert.equal(
        r.ctaFg,
        "rgb(255, 255, 255)",
        `CTA text should be white in ${r.mode}/${r.accent}, got ${r.ctaFg}`,
      );
    } else {
      assert.ok(
        r.ctaContrast >= 4.5,
        `CTA contrast too low in ${r.mode}/${r.accent}: ${r.ctaContrast.toFixed(2)}`,
      );
    }
  }
  assert.ok(
    new Set(themeAudit.filter((r) => r.mode === "light").map((r) => r.ctaBg)).size >= 6,
    "CTA background adapts live across all 6 accent themes",
  );
  assert.ok(
    new Set(themeAudit.filter((r) => r.mode === "light").map((r) => r.doodleColor)).size >= 2,
    "Doodle pattern adapts live to theme tokens",
  );
  // Verify Spanish translation + interpolation via Settings > Appearance language switch.
  await goto("/settings/appearance");
  const saveEs = page.waitForResponse(
    (r) => r.url().includes("/user_settings") && r.request().method() === "PATCH",
  );
  await page.locator("#language").selectOption("es");
  await page.waitForFunction(() => document.documentElement.lang === "es");
  await saveEs;
  await goto(`/channels/${emptyUnfollowed}`);
  await page.locator('[data-slot="conversation-start-pill"]').waitFor();
  assert.equal(
    await page.locator('[data-slot="conversation-start-pill"]').textContent(),
    "Inicio de esta conversación",
  );
  assert.equal(
    await page.locator('[data-slot="conversation-encryption-pill"]').textContent(),
    "Los mensajes están cifrados de extremo a extremo. Nadie fuera de este chat puede leerlos ni escucharlos.",
  );
  assert.equal(
    await page.locator('[data-slot="channel-created-pill"]').textContent(),
    'Se creó el canal "Discover 3".',
  );
  assert.equal(
    await page.locator('[data-slot="channel-follow-cta"]').textContent(),
    "Seguir canal",
  );
  await goto("/settings/appearance");
  const saveEn = page.waitForResponse(
    (r) => r.url().includes("/user_settings") && r.request().method() === "PATCH",
  );
  await page.locator("#language").selectOption("en");
  await page.waitForFunction(() => document.documentElement.lang === "en");
  await saveEn;
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
  const createDialog = page.getByRole("dialog", {
    name: "Create channel",
    exact: true,
  });
  await cycleFocus(createDialog);
  await page.keyboard.press("Escape");
  await createDialog.waitFor({ state: "detached" });
  assert.ok(
    await page
      .getByRole("button", { name: "Create channel", exact: true })
      .evaluate((el) => el === document.activeElement),
  );
  await page.getByRole("button", { name: "Create channel", exact: true }).click();
  failChannelSlug = true;
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Café Announcements");
  await createDialog.getByRole("status").filter({ hasText: "Availability check failed" }).waitFor();
  failChannelSlug = false;
  assert.equal(
    await page.getByRole("textbox", { name: "Slug", exact: true }).inputValue(),
    "cafe-announcements",
  );
  await page.getByRole("button", { name: "Channel photo (optional)", exact: true }).click();
  const cropDialog = page.getByRole("dialog", {
    name: "Change photo",
    exact: true,
  });
  await cropDialog
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await cropDialog.locator(".avatar-crop img").waitFor();
  await cropDialog.getByRole("slider").fill("2");
  await cycleFocus(cropDialog);
  await cropDialog.getByRole("button", { name: "Save", exact: true }).click();
  await cropDialog.waitFor({ state: "detached" });
  assert.ok(
    await page
      .getByRole("button", { name: "Channel photo (optional)", exact: true })
      .evaluate((el) => el === document.activeElement),
  );
  await createDialog.locator(".avatar-preview").waitFor();
  await cycleFocus(createDialog);
  failChannelAvatar = true;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create channel", exact: true })
    .click();
  await createDialog
    .getByText("Channel created. Retry the photo upload or continue without a photo.", {
      exact: true,
    })
    .waitFor();
  assert.equal(channelCreates, 1);
  assert.ok(await createDialog.getByRole("textbox", { name: "Name", exact: true }).isDisabled());
  failChannelAvatar = false;
  await createDialog.getByRole("button", { name: "Finish", exact: true }).click();
  await page.waitForURL(`**/channels/${uid(999)}/info`);
  assert.equal(channelCreates, 1);
  const avatar = uploads.findLast(
    (x) => x.bucket === "avatars" && x.path.startsWith(`chat-${uid(999)}/channel-`),
  );
  assert.ok(avatar);
  assert.equal(avatar.mime_type, "image/webp");
  assert.equal(avatar.width, 512);
  assert.equal(avatar.height, 512);
  assert.ok(avatar.size_bytes < 100000);
  assert.equal(channels.find((x) => x.id === uid(999)).avatar_url, avatar.path);
  await page.getByRole("button", { name: "Delete channel", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete channel", exact: true })
    .click();
  await page.waitForURL("**/novedades");
  await goto("/channels");
  await page.waitForURL("**/novedades");
  await goto("/channels/new");
  await page.waitForURL("**/novedades?create=true");
  const redirectedCreate = page.getByRole("dialog", {
    name: "Create channel",
    exact: true,
  });
  await redirectedCreate.getByRole("button", { name: "Cancel", exact: true }).click();
  await redirectedCreate.waitFor({ state: "detached" });
  await page.getByRole("link", { name: /Explore more/ }).click();
  await page.waitForURL("**/novedades/explore");
  for (let i = 0; i < 8; i++) {
    const id = uid(700 + i);
    profiles.push({
      id,
      username: `reader${i}`,
      display_name: `Reader ${i}`,
      avatar_url: null,
    });
    stories.push(story(800 + i, id));
  }
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    isMobile: true,
    hasTouch: true,
  });
  await setup(mobile);
  const mp = await mobile.newPage();
  await mp.goto(`${baseUrl}/novedades`);
  await mp.getByRole("button", { name: "My story", exact: true }).waitFor();
  await mp.locator(".channel-list-item").first().waitFor();
  assert.ok(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const row = mp.locator(".stories-row");
  assert.ok(await row.evaluate((el) => el.scrollWidth > el.clientWidth));
  const rowBox = await row.boundingBox();
  const touch = await mobile.newCDPSession(mp);
  const touchAt = (type, x, y) =>
    touch.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y }],
    });
  await touchAt("touchStart", rowBox.x + rowBox.width - 20, rowBox.y + 100);
  for (let dx = 0; dx <= 240; dx += 20)
    await touchAt("touchMove", rowBox.x + rowBox.width - 20 - dx, rowBox.y + 100);
  await touchAt("touchEnd");
  await mp.waitForFunction(() => document.querySelector(".stories-row").scrollLeft > 100);
  assert.ok(
    await mp.locator(".story-card").evaluateAll((cards) =>
      cards.every((el) => {
        el.scrollTop = 10;
        return el.scrollTop === 0 && ["clip", "hidden"].includes(getComputedStyle(el).overflowY);
      }),
    ),
  );
  await row.evaluate((el) => {
    el.scrollLeft = 0;
  });
  const badge = mp.locator('.channel-list-item [aria-label="Verified"]');
  assert.ok(
    await badge.evaluate(
      (el) => getComputedStyle(el).color !== getComputedStyle(el.parentElement).color,
    ),
  );
  await mp.getByRole("button", { name: "Sofia", exact: true }).click();
  await assertStoryViewerLayout(mp);
  const swipe = await mp.locator(".story-stage").boundingBox();
  await touchAt("touchStart", swipe.x + swipe.width / 2, swipe.y + 60);
  await mp.waitForTimeout(150);
  const frozen = await mp.locator(".story-progress").innerHTML();
  await mp.waitForTimeout(3200);
  assert.equal(await mp.locator(".story-progress").innerHTML(), frozen);
  await touchAt("touchEnd");
  await mp.waitForTimeout(250);
  assert.notEqual(await mp.locator(".story-progress").innerHTML(), frozen);
  await mp.locator(".story-stage").tap({ position: { x: swipe.width - 30, y: 60 } });
  await mp.locator(".story-stage").getByText("Story 300", { exact: true }).waitFor();
  await mp.locator(".story-stage").tap({ position: { x: 30, y: 60 } });
  await mp.locator(".story-stage").getByText("Story 301", { exact: true }).waitFor();
  // A held pointer leaving the stage must release the pause without navigating.
  await mp.mouse.move(swipe.x + swipe.width / 2, swipe.y + 60);
  await mp.mouse.down();
  await mp.waitForTimeout(100);
  const beforeLeave = await mp.locator(".story-progress").innerHTML();
  await mp.mouse.move(swipe.x - 5, swipe.y + 60);
  await mp.waitForTimeout(250);
  assert.notEqual(await mp.locator(".story-progress").innerHTML(), beforeLeave);
  await mp.mouse.up();
  await mp.mouse.move(swipe.x + swipe.width / 2, swipe.y + 30);
  await mp.mouse.down();
  await mp.mouse.move(swipe.x + swipe.width / 2, swipe.y + 160, { steps: 8 });
  await mp.mouse.up();
  await mp.getByRole("dialog", { name: "Story", exact: true }).waitFor({ state: "detached" });
  // Mobile check for empty unfollowed channel: centered pills, pinned CTA, no overflow.
  await mp.goto(`${baseUrl}/channels/${emptyUnfollowed}`);
  await mp.locator('[data-slot="channel-follow-cta"]').waitFor();
  assert.ok(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const mobileMetrics = await mp.evaluate(() => {
    const header = document
      .querySelector('[data-slot="conversation-shell-header"]')
      .getBoundingClientRect();
    const ctaRect = document
      .querySelector('[data-slot="channel-follow-cta"]')
      .getBoundingClientRect();
    const pills = [...document.querySelectorAll(".system-pill")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        centerOffset: Math.abs(r.left + r.width / 2 - innerWidth / 2),
      };
    });
    return {
      headerBottom: header.bottom,
      ctaTop: ctaRect.top,
      ctaBottom: ctaRect.bottom,
      pills,
      innerWidth,
    };
  });
  assert.ok(mobileMetrics.ctaTop > mobileMetrics.headerBottom);
  for (const pill of mobileMetrics.pills) {
    assert.ok(
      pill.left >= 0 && pill.right <= mobileMetrics.innerWidth,
      "Pill stays within mobile viewport",
    );
    assert.ok(pill.centerOffset <= 4, `Pill stays centered (offset ${pill.centerOffset})`);
  }
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: stories text/image/video uploads, duration rejection/playback, ordering/timer/hold/navigation/reply/idempotent creation/viewers/delete; discover top20/follow; channel Realtime/paging/read-only/react8/mute/owner composer/edit/create/delete, cursor retry, availability failure, one create after avatar retry, route redirects; explore; mobile layout.",
  );
} catch (e) {
  console.error(await page.locator("body").textContent());
  throw e;
} finally {
  await browser.close();
}
