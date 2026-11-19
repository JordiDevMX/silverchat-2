// Real Chromium verification for user-level hold-drag 3D cube navigation,
// story-level tap/auto-advance navigation, and the unified interruptible transition engine.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { launchBrowser } from "./lib/browser.mjs";

const clipBytes = execFileSync("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-f",
  "lavfi",
  "-i",
  "color=c=purple:s=160x120:r=5:d=6",
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

const browser = await launchBrowser({ args: ["--no-sandbox"] });

const uid = (n) => `${String(n).padStart(8, "0")}-4444-4444-8444-444444444444`;
const me = uid(1);
const sofia = uid(2);
const diego = uid(3);
const clara = uid(4);

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
  { id: sofia, username: "sofia", display_name: "Sofia", avatar_url: null },
  { id: diego, username: "diego", display_name: "Diego", avatar_url: null },
  { id: clara, username: "clara", display_name: "Clara", avatar_url: null },
];

const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(
  JSON.stringify({ sub: me, aal: "aal2", exp: Math.floor(Date.now() / 1000) + 3600 }),
).toString("base64url")}.signature`;

const photoUploadId = uid(900);
const videoUploadId = uid(901);
const photoSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#2563eb"/><text x="200" y="300" fill="#fff" font-size="32" text-anchor="middle">Diego Photo</text></svg>',
);

const uploads = [
  {
    id: photoUploadId,
    bucket: "story-media",
    path: `${diego}/photo.svg`,
    mime_type: "image/svg+xml",
    original_filename: "photo.svg",
    size_bytes: photoSvg.length,
  },
  {
    id: videoUploadId,
    bucket: "story-media",
    path: `${diego}/clip.mp4`,
    mime_type: "video/mp4",
    original_filename: "clip.mp4",
    size_bytes: clipBytes.length,
  },
];

const baseTs = Date.now();
const future = new Date(baseTs + 86_400_000).toISOString();

// Locked cross-user order: mine (Alice) -> unwatched newest-first (Sofia, Diego) -> watched (Clara).
// Timeline indices (4 users, 10 stories total):
// 0: Mine 1 (Alice)      1: Mine 2 (Alice)
// 2: Sofia 1 (Sofia)     3: Sofia 2 (Sofia)     4: Sofia 3 (Sofia)
// 5: Diego 1 (image)     6: Diego 2 (video)     7: Diego 3 (text)
// 8: Clara 1 (Clara)     9: Clara 2 (Clara)
const stories = [
  {
    id: uid(10),
    user_id: me,
    media_type: "text",
    text_content: "Mine 1",
    background_color: "#0f766e",
    caption: null,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    created_at: new Date(baseTs - 80_000).toISOString(),
    expires_at: future,
  },
  {
    id: uid(11),
    user_id: me,
    media_type: "text",
    text_content: "Mine 2",
    background_color: "#115e59",
    caption: null,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    created_at: new Date(baseTs - 70_000).toISOString(),
    expires_at: future,
  },
  {
    id: uid(20),
    user_id: sofia,
    media_type: "text",
    text_content: "Sofia 1",
    background_color: "#1d4ed8",
    caption: null,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    created_at: new Date(baseTs - 15_000).toISOString(),
    expires_at: future,
  },
  {
    id: uid(21),
    user_id: sofia,
    media_type: "text",
    text_content: "Sofia 2",
    background_color: "#1e40af",
    caption: null,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    created_at: new Date(baseTs - 12_000).toISOString(),
    expires_at: future,
  },
  {
    id: uid(22),
    user_id: sofia,
    media_type: "text",
    text_content: "Sofia 3",
    background_color: "#1e3a8a",
    caption: null,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    created_at: new Date(baseTs - 10_000).toISOString(),
    expires_at: future,
  },
  {
    id: uid(30),
    user_id: diego,
    media_type: "image",
    text_content: null,
    background_color: null,
    caption: "Diego Photo Caption",
    file_upload_id: photoUploadId,
    media_thumbnail_upload_id: null,
    created_at: new Date(baseTs - 45_000).toISOString(),
    expires_at: future,
  },
  {
    id: uid(31),
    user_id: diego,
    media_type: "video",
    text_content: null,
    background_color: null,
    caption: "Diego Video",
    file_upload_id: videoUploadId,
    media_thumbnail_upload_id: null,
    created_at: new Date(baseTs - 40_000).toISOString(),
    expires_at: future,
  },
  {
    id: uid(32),
    user_id: diego,
    media_type: "text",
    text_content: "Diego 3",
    background_color: "#6d28d9",
    caption: null,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    created_at: new Date(baseTs - 35_000).toISOString(),
    expires_at: future,
  },
  {
    id: uid(40),
    user_id: clara,
    media_type: "text",
    text_content: "Clara 1",
    background_color: "#b45309",
    caption: null,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    created_at: new Date(baseTs - 95_000).toISOString(),
    expires_at: future,
  },
  {
    id: uid(41),
    user_id: clara,
    media_type: "text",
    text_content: "Clara 2",
    background_color: "#92400e",
    caption: null,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    created_at: new Date(baseTs - 90_000).toISOString(),
    expires_at: future,
  },
];

const views = [
  { story_id: uid(40), viewer_id: me },
  { story_id: uid(41), viewer_id: me },
];
const consoleErrors = [];
const pageErrors = [];

const respond = (r, v, status = 200) =>
  r.fulfill({ status, contentType: "application/json", body: JSON.stringify(v) });

async function attachMocks(ctx) {
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
    const req = r.request();
    const url = new URL(req.url());
    const s = url.searchParams;
    const p = url.pathname;
    const method = req.method();
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
      return respond(r, {
        user_id: me,
        theme: "light",
        accent: "blue",
        language: "en",
        read_receipts_enabled: true,
      });
    }
    if (p.endsWith("/profiles_visible")) return result(filter(profiles));
    if (p.endsWith("/app_config")) return result([{ key: "avatar_gradient_palette", value: [] }]);
    if (p.endsWith("/stories")) {
      return result(filter(stories).sort((a, b) => a.created_at.localeCompare(b.created_at)));
    }
    if (p.endsWith("/story_views")) return result(views);
    if (p.endsWith("/file_uploads")) return result(filter(uploads));
    if (p.includes("/storage/v1/object/sign/")) {
      const key = decodeURIComponent(p.split("/object/sign/")[1]);
      if (method === "POST") return respond(r, { signedURL: `/object/sign/${key}?token=fake` });
      if (key === `story-media/${diego}/photo.svg`) {
        return r.fulfill({ status: 200, contentType: "image/svg+xml", body: photoSvg });
      }
      if (key === `story-media/${diego}/clip.mp4`) {
        return r.fulfill({ status: 200, contentType: "video/mp4", body: clipBytes });
      }
      return r.fulfill({ status: 404 });
    }
    if (p.includes("/rpc/mark_story_viewed")) {
      if (!views.some((v) => v.story_id === body.p_story_id)) {
        views.push({ story_id: body.p_story_id, viewer_id: me });
      }
      return respond(r, null);
    }
    if (p.includes("/rpc/get_story_viewers")) return respond(r, []);
    return result([]);
  });
  await ctx.routeWebSocket("**/realtime/v1/websocket*", (socket) =>
    socket.onMessage((raw) => {
      const [join, ref, topic, event] = JSON.parse(String(raw));
      if (event === "phx_join") {
        socket.send(
          JSON.stringify([join, ref, topic, "phx_reply", { status: "ok", response: {} }]),
        );
      }
      if (event === "heartbeat") {
        socket.send(
          JSON.stringify([join, ref, topic, "phx_reply", { status: "ok", response: {} }]),
        );
      }
    }),
  );
  ctx.on("page", (p) => {
    p.on("pageerror", (e) => pageErrors.push(e.message));
    p.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
  });
}

const baseUrl = process.env.TEST_BASE_URL ?? "http://127.0.0.1:5176";

async function waitSettled(page) {
  await page.waitForFunction(
    () => document.querySelector(".story-cube-viewport")?.getAttribute("data-settling") === "false",
    null,
    { timeout: 3000 },
  );
}

async function getActiveStoryState(page) {
  return page.evaluate(() => {
    const shell = document.querySelector(".story-viewer-shell");
    const viewport = document.querySelector(".story-cube-viewport");
    const activeFace = document.querySelector('.story-cube-face[data-story-active="true"]');
    const stage = document.querySelector(".story-stage");
    const headerName = document.querySelector(".story-viewer-header strong")?.textContent ?? null;
    const segments = document.querySelectorAll(".story-progress > div").length;
    const faces = [...document.querySelectorAll(".story-cube-face")].map((el) => {
      const shade = el.querySelector(".story-cube-shade");
      const rect = el.getBoundingClientRect();
      return {
        index: Number(el.getAttribute("data-story-index")),
        id: el.getAttribute("data-story-id"),
        active: el.getAttribute("data-story-active") === "true",
        visibility: el.style.visibility,
        transform: el.style.transform,
        opacity: Number(el.style.opacity || "1"),
        shadeOpacity: Number(shade?.style.opacity || "0"),
        left: rect.left,
        right: rect.right,
      };
    });
    return {
      chromeHidden: shell?.getAttribute("data-chrome-hidden") === "true",
      reducedMotion: shell?.getAttribute("data-reduced-motion") === "true",
      dragging: viewport?.getAttribute("data-dragging") === "true",
      holding: viewport?.getAttribute("data-holding") === "true",
      settling: viewport?.getAttribute("data-settling") === "true",
      activeIndex: Number(activeFace?.getAttribute("data-story-index") ?? -1),
      activeId: activeFace?.getAttribute("data-story-id") ?? null,
      stageText: stage?.textContent ?? "",
      headerName,
      segments,
      faces,
    };
  });
}

function extractRotateY(transform) {
  const m = transform.match(/rotateY\(([-\d.]+)deg\)/);
  return m ? Number(m[1]) : 0;
}

async function dragMouse(
  page,
  startX,
  startY,
  endX,
  endY,
  { steps = 10, holdBeforeMs = 200, holdAfterMs = 0 } = {},
) {
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  if (holdBeforeMs > 0) await page.waitForTimeout(holdBeforeMs);
  await page.mouse.move(endX, endY, { steps });
  if (holdAfterMs > 0) await page.waitForTimeout(holdAfterMs);
  await page.mouse.up();
}

try {
  // =========================================================================
  // PART 1: DESKTOP MOUSE + KEYBOARD FLOWS (USER-LEVEL DRAG vs STORY-LEVEL TAP)
  // =========================================================================
  const desktopCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await attachMocks(desktopCtx);
  const page = await desktopCtx.newPage();
  page.setDefaultTimeout(10000);

  await page.goto(`${baseUrl}/novedades`);
  await page.getByRole("button", { name: "Sofia", exact: true }).click();
  await page.locator(".story-stage").getByText("Sofia 1", { exact: true }).waitFor();
  await waitSettled(page);

  // 1. Verify next USER's first story (Diego 1 image, idx 5) is ALREADY preloaded before any drag!
  await page.waitForFunction(() => {
    const img = document.querySelector('.story-cube-face[data-story-index="5"] img');
    return Boolean(img?.complete && img.naturalWidth > 0);
  });
  await page.evaluate(() => {
    const img = document.querySelector('.story-cube-face[data-story-index="5"] img');
    img.__persistedUserNextTag = "diego-first-stable";
  });

  const vp = await page.locator(".story-cube-viewport").boundingBox();
  assert.ok(vp && vp.width > 200, "Viewport must render");
  const cx = vp.x + vp.width / 2;
  const cy = vp.y + vp.height / 2;

  // 2. Quick tap RIGHT (story-level): steps from Sofia 1 (idx 2) -> Sofia 2 (idx 3) with leftward cube motion
  await page.mouse.click(vp.x + vp.width * 0.75, cy);
  await page.waitForFunction(
    () => {
      const faces = [...document.querySelectorAll(".story-cube-face")];
      return faces.some((el) => /rotateY\(([-\d.]+)deg\)/.test(el.style.transform));
    },
    null,
    { timeout: 1500 },
  );
  const midTap = await getActiveStoryState(page);
  assert.equal(midTap.activeIndex, 3, "Quick tap right must step story-by-story to Sofia 2");
  assert.equal(midTap.settling, true, "Quick tap must use unified cube transition");
  const tapOut = midTap.faces.find((f) => f.index === 2);
  const tapIn = midTap.faces.find((f) => f.index === 3);
  assert.ok(
    extractRotateY(tapOut.transform) < -1 && extractRotateY(tapIn.transform) > 1,
    `Forward tap must rotate leftward (outgoing -Y, incoming +Y from right), got ${JSON.stringify(midTap.faces)}`,
  );
  assert.ok(
    tapOut.left < tapIn.left,
    "Outgoing face must exit left while incoming enters from right",
  );
  await waitSettled(page);
  assert.equal((await getActiveStoryState(page)).headerName, "Sofia");
  assert.equal((await getActiveStoryState(page)).segments, 3);

  // 3. Hold without drag on Sofia 2 (idx 3): pauses timer, hides chrome, release restores & never taps
  await page.mouse.move(cx - 90, cy);
  await page.mouse.down();
  await page.waitForTimeout(260);
  const whileHeld = await getActiveStoryState(page);
  assert.equal(whileHeld.holding, true);
  assert.equal(whileHeld.chromeHidden, true);
  await page.waitForTimeout(220);
  const chromeOpacityAfter = await page.evaluate(() => ({
    header: Number(getComputedStyle(document.querySelector(".story-viewer-header")).opacity),
    footer: Number(getComputedStyle(document.querySelector(".story-viewer footer")).opacity),
  }));
  assert.ok(chromeOpacityAfter.header < 0.05 && chromeOpacityAfter.footer < 0.05);
  const progressFrozen = await page.locator(".story-progress").innerHTML();
  await page.waitForTimeout(450);
  assert.equal(await page.locator(".story-progress").innerHTML(), progressFrozen);
  await page.mouse.up();
  await page.waitForTimeout(250);
  assert.equal((await getActiveStoryState(page)).activeIndex, 3, "Hold release must not tap");
  assert.equal((await getActiveStoryState(page)).chromeHidden, false);
  assert.notEqual(await page.locator(".story-progress").innerHTML(), progressFrozen);

  // 4. Spring-back from middle of Sofia's tray (Sofia 2, idx 3): sub-threshold right->left drag previews Diego 1 then springs back
  const progressBeforeSpringBack = await page.locator(".story-progress").innerHTML();
  await dragMouse(page, cx, cy, cx - vp.width * 0.15, cy, {
    steps: 8,
    holdBeforeMs: 200,
    holdAfterMs: 120,
  });
  await waitSettled(page);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    3,
    "Slow sub-threshold drag must spring back to Sofia 2",
  );
  assert.ok(progressBeforeSpringBack.length > 0);

  // 5. Hold + drag RIGHT -> LEFT (dx < 0) from middle of Sofia's tray (Sofia 2, idx 3) -> NEXT USER's FIRST story (Diego 1, idx 5)!
  // Current story exits LEFT, Diego 1 enters live from RIGHT (NOT Sofia 3!), Sofia 3 stays unseen, <img> never remounts!
  await page.mouse.move(cx + 80, cy);
  await page.mouse.down();
  await page.waitForTimeout(210);
  await page.mouse.move(cx + 80 - vp.width * 0.45, cy, { steps: 12 });
  const midForwardDrag = await getActiveStoryState(page);
  assert.equal(midForwardDrag.dragging, true);
  assert.equal(midForwardDrag.chromeHidden, true);
  const currFace = midForwardDrag.faces.find((f) => f.index === 3);
  const nextUserFace = midForwardDrag.faces.find((f) => f.index === 5);
  const skippedSameUserFace = midForwardDrag.faces.find((f) => f.index === 4);
  assert.equal(currFace?.visibility, "visible", "Current story (Sofia 2) must be visible mid-drag");
  assert.equal(
    nextUserFace?.visibility,
    "visible",
    "Live cube preview must show NEXT USER's first story (Diego 1, idx 5)",
  );
  assert.notEqual(
    skippedSameUserFace?.visibility,
    "visible",
    "Skipped same-user story (Sofia 3, idx 4) must NOT be previewed during user drag",
  );
  assert.ok(
    extractRotateY(currFace.transform) < -20,
    `Current face must rotate -Y (exit left), got ${currFace.transform}`,
  );
  assert.ok(
    extractRotateY(nextUserFace.transform) > 20,
    `Incoming NEXT user face must rotate +Y (enter from right), got ${nextUserFace.transform}`,
  );
  assert.ok(
    currFace.left < nextUserFace.left,
    `Current face must sit left of incoming next user face (curr=${currFace.left}, next=${nextUserFace.left})`,
  );
  assert.ok(currFace.shadeOpacity > 0.05 && nextUserFace.shadeOpacity > 0.05);

  await page.mouse.up();
  await waitSettled(page);
  const atDiego1 = await getActiveStoryState(page);
  assert.equal(
    atDiego1.activeIndex,
    5,
    "Drag right->left must commit to Diego's FIRST story (idx 5)",
  );
  assert.equal(atDiego1.headerName, "Diego");
  assert.equal(atDiego1.segments, 3);
  assert.equal(atDiego1.chromeHidden, false);
  const imgPreserved = await page.evaluate(
    () =>
      document.querySelector(".story-stage img")?.__persistedUserNextTag === "diego-first-stable",
  );
  assert.equal(imgPreserved, true, "Preloaded next-user <img> must not remount on commit");
  assert.equal(
    views.some((v) => v.story_id === uid(22)),
    false,
    "Skipped story (Sofia 3) must NOT be marked as seen",
  );

  // 6. Story-level navigation inside Diego's tray: preloaded MP4 video (idx 6) promoted without remount
  await page.waitForFunction(() => {
    const v = document.querySelector('.story-cube-face[data-story-index="6"] video');
    return Boolean(v && v.readyState >= 1);
  });
  const preloadedVideo = await page.evaluate(() => {
    const v = document.querySelector('.story-cube-face[data-story-index="6"] video');
    v.__persistedVideoTag = "diego-video-stable";
    return { muted: v.muted, paused: v.paused };
  });
  assert.equal(preloadedVideo.muted, true);
  assert.equal(preloadedVideo.paused, true);

  await page.keyboard.press("ArrowRight");
  await waitSettled(page);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    6,
    "ArrowRight steps story-level to Diego 2 video",
  );
  const activeVideo = await page.evaluate(() => {
    const v = document.querySelector(".story-stage video");
    return { tag: v?.__persistedVideoTag ?? null, muted: v?.muted ?? true };
  });
  assert.equal(activeVideo.tag, "diego-video-stable");
  assert.equal(activeVideo.muted, false);

  // Typing ArrowLeft inside reply input must NOT navigate away
  const replyInput = page.getByRole("textbox", { name: "Reply to story" });
  await replyInput.click();
  await replyInput.fill("Hey");
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(120);
  assert.equal((await getActiveStoryState(page)).activeIndex, 6);
  await replyInput.fill("");
  await page.locator(".story-viewer-header").click();

  // 7. Hold + drag LEFT -> RIGHT (dx > 0) from middle of Diego's tray (Diego 2, idx 6) -> PREVIOUS USER's FIRST story (Sofia 1, idx 2)!
  await page.mouse.move(cx - 80, cy);
  await page.mouse.down();
  await page.waitForTimeout(210);
  await page.mouse.move(cx - 80 + vp.width * 0.45, cy, { steps: 12 });
  const midBackDrag = await getActiveStoryState(page);
  const currBackFace = midBackDrag.faces.find((f) => f.index === 6);
  const prevUserFirstFace = midBackDrag.faces.find((f) => f.index === 2);
  const sameUserPrevFace = midBackDrag.faces.find((f) => f.index === 5);
  assert.equal(
    prevUserFirstFace?.visibility,
    "visible",
    "Live backward-drag preview must show PREVIOUS USER's FIRST story (Sofia 1, idx 2)",
  );
  assert.notEqual(
    sameUserPrevFace?.visibility,
    "visible",
    "Same-user previous story (Diego 1, idx 5) must NOT be previewed during user drag",
  );
  assert.ok(extractRotateY(currBackFace.transform) > 20);
  assert.ok(extractRotateY(prevUserFirstFace.transform) < -20);
  assert.ok(
    prevUserFirstFace.left < currBackFace.left,
    "Previous user face must enter from LEFT while current exits RIGHT",
  );
  await page.mouse.up();
  await waitSettled(page);
  const backAtSofia1 = await getActiveStoryState(page);
  assert.equal(
    backAtSofia1.activeIndex,
    2,
    "Drag left->right must land on PREVIOUS user's FIRST story (Sofia 1)",
  );
  assert.equal(backAtSofia1.headerName, "Sofia");
  assert.equal(
    views.some((v) => v.story_id === uid(32)),
    false,
    "Skipped story (Diego 3) must NOT be marked as seen",
  );

  // 8. Velocity flings jump one user tray at a time: Sofia 1 (2) -> Diego 1 (5) -> Clara 1 (8)
  await dragMouse(page, cx, cy, cx - vp.width * 0.16, cy, { steps: 3, holdBeforeMs: 0 });
  await waitSettled(page);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    5,
    "Right->left fling must jump to Diego 1",
  );

  await dragMouse(page, cx, cy, cx - vp.width * 0.16, cy, { steps: 3, holdBeforeMs: 0 });
  await waitSettled(page);
  const atClara1 = await getActiveStoryState(page);
  assert.equal(atClara1.activeIndex, 8, "Right->left fling must jump to Clara 1");
  assert.equal(atClara1.headerName, "Clara");
  assert.equal(atClara1.segments, 2);

  // 9. Last-user boundary rubber-band even from Clara's FIRST story (Clara 1, idx 8 — Clara 2 exists at idx 9!)
  await page.mouse.move(cx + 100, cy);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.move(cx + 100 - vp.width * 0.75, cy, { steps: 10 });
  const lastUserBound = await getActiveStoryState(page);
  const lastAngle = extractRotateY(lastUserBound.faces.find((f) => f.index === 8)?.transform ?? "");
  assert.ok(
    lastAngle < -3 && lastAngle > -30,
    `Last-user forward drag must apply rubber-band resistance (-30 < deg < -3), got ${lastAngle}`,
  );
  assert.notEqual(
    lastUserBound.faces.find((f) => f.index === 9)?.visibility,
    "visible",
    "Clara 2 must NOT appear on user-level forward drag at last user",
  );
  await page.mouse.up();
  await waitSettled(page);
  assert.equal((await getActiveStoryState(page)).activeIndex, 8);

  // Left->right flings return to Diego 1 (5) -> Sofia 1 (2) -> Mine 1 (0)
  await dragMouse(page, cx, cy, cx + vp.width * 0.16, cy, { steps: 3, holdBeforeMs: 0 });
  await waitSettled(page);
  assert.equal((await getActiveStoryState(page)).activeIndex, 5);

  await dragMouse(page, cx, cy, cx + vp.width * 0.16, cy, { steps: 3, holdBeforeMs: 0 });
  await waitSettled(page);
  assert.equal((await getActiveStoryState(page)).activeIndex, 2);

  await dragMouse(page, cx - 80, cy, cx - 80 + vp.width * 0.42, cy, {
    steps: 10,
    holdBeforeMs: 200,
  });
  await waitSettled(page);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    0,
    "Drag left->right from Sofia must land on Mine 1 (idx 0)",
  );

  // 10. First-user boundary rubber-band even from Alice's SECOND story (Mine 2, idx 1 — Mine 1 exists at idx 0!)
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await waitSettled(page);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    1,
    "Next button steps story-level to Mine 2",
  );

  await page.mouse.move(cx - 100, cy);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.move(cx - 100 + vp.width * 0.75, cy, { steps: 10 });
  const firstUserBound = await getActiveStoryState(page);
  const firstAngle = extractRotateY(
    firstUserBound.faces.find((f) => f.index === 1)?.transform ?? "",
  );
  assert.ok(
    firstAngle > 3 && firstAngle < 30,
    `First-user backward drag must apply rubber-band resistance (3 < deg < 30), got ${firstAngle}`,
  );
  assert.notEqual(
    firstUserBound.faces.find((f) => f.index === 0)?.visibility,
    "visible",
    "Mine 1 must NOT appear on user-level backward drag at first user",
  );
  await page.mouse.up();
  await waitSettled(page);
  assert.equal((await getActiveStoryState(page)).activeIndex, 1);

  // 11. Mid-flight interruption & retargeting (both story-level and user-level!)
  // Story-level double mid-flight tap/ArrowRight: Mine 2 (1) -> Sofia 1 (2) -> Sofia 2 (3)
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(50);
  await page.keyboard.press("ArrowRight");
  await waitSettled(page);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    3,
    "Double mid-flight ArrowRight must chain cleanly to Sofia 2",
  );

  // Interrupt a settling forward user-drag mid-flight and pull it back right onto Sofia 2 (idx 3)
  await dragMouse(page, cx + 60, cy, cx + 60 - vp.width * 0.35, cy, { steps: 5, holdBeforeMs: 0 });
  await page.waitForTimeout(45);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  assert.equal(
    (await getActiveStoryState(page)).settling,
    false,
    "Pointerdown interrupts settling",
  );
  await page.mouse.move(cx + vp.width * 0.4, cy, { steps: 8 });
  await page.mouse.up();
  await waitSettled(page);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    3,
    "Interrupting user-drag settle and pulling back right must settle cleanly on Sofia 2",
  );

  // 12. Timer auto-advance (story-level): Mine 1 (idx 0) auto-advances to Mine 2 (idx 1) via unified cube engine
  await dragMouse(page, cx - 80, cy, cx - 80 + vp.width * 0.42, cy, {
    steps: 10,
    holdBeforeMs: 200,
  });
  await waitSettled(page);
  assert.equal((await getActiveStoryState(page)).activeIndex, 0);

  let sawAutoAdvanceCube = false;
  await page.exposeFunction("__reportAutoAdvanceCube", () => {
    sawAutoAdvanceCube = true;
  });
  await page.evaluate(() => {
    const vpEl = document.querySelector(".story-cube-viewport");
    const obs = new MutationObserver(() => {
      if (vpEl?.getAttribute("data-settling") === "true") {
        window.__reportAutoAdvanceCube();
      }
    });
    obs.observe(vpEl, { attributes: true, attributeFilter: ["data-settling"] });
  });
  await page
    .locator(".story-stage")
    .getByText("Mine 2", { exact: true })
    .waitFor({ timeout: 7500 });
  await waitSettled(page);
  assert.equal(
    sawAutoAdvanceCube,
    true,
    "Auto-advance must step story-level through unified cube transition",
  );

  // 13. Swipe-down dismiss + tap-right past absolute last story (Clara 2) closes viewer
  await dragMouse(page, cx, cy - 50, cx, cy + 120, { steps: 8, holdBeforeMs: 0 });
  await page.getByRole("dialog", { name: "Story", exact: true }).waitFor({ state: "detached" });

  await page.getByRole("button", { name: "Clara", exact: true }).click();
  await page.locator(".story-stage").getByText("Clara 1", { exact: true }).waitFor();
  const vpLast = await page.locator(".story-cube-viewport").boundingBox();
  // Tap right -> Clara 2 (idx 9), then tap right again -> closes viewer
  await page.mouse.click(vpLast.x + vpLast.width * 0.75, vpLast.y + vpLast.height / 2);
  await page.locator(".story-stage").getByText("Clara 2", { exact: true }).waitFor();
  await waitSettled(page);
  await page.mouse.click(vpLast.x + vpLast.width * 0.75, vpLast.y + vpLast.height / 2);
  await page.getByRole("dialog", { name: "Story", exact: true }).waitFor({ state: "detached" });

  // =========================================================================
  // PART 2: REDUCED MOTION CROSSFADE FALLBACK (USER-LEVEL DRAG)
  // =========================================================================
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Sofia", exact: true }).click();
  await page.locator(".story-stage").getByText("Sofia 1", { exact: true }).waitFor();
  await waitSettled(page);
  const vpRm = await page.locator(".story-cube-viewport").boundingBox();
  const rmCx = vpRm.x + vpRm.width / 2;
  const rmCy = vpRm.y + vpRm.height / 2;
  await page.mouse.move(rmCx + 60, rmCy);
  await page.mouse.down();
  await page.waitForTimeout(210);
  await page.mouse.move(rmCx + 60 - vpRm.width * 0.45, rmCy, { steps: 10 });
  const rmDrag = await getActiveStoryState(page);
  assert.equal(rmDrag.reducedMotion, true);
  const rmCurr = rmDrag.faces.find((f) => f.index === 2);
  const rmNextUser = rmDrag.faces.find((f) => f.index === 5);
  assert.equal(rmCurr?.transform, "none");
  assert.equal(rmNextUser?.transform, "none");
  assert.ok(rmCurr.opacity > 0.2 && rmCurr.opacity < 0.85);
  assert.ok(rmNextUser.opacity > 0.15 && rmNextUser.opacity < 0.8);
  assert.equal(rmCurr.shadeOpacity, 0);
  await page.mouse.up();
  await waitSettled(page);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    5,
    "Reduced motion right->left drag jumps to Diego 1",
  );
  await page.getByRole("button", { name: "Close story", exact: true }).click();
  await page.getByRole("dialog", { name: "Story", exact: true }).waitFor({ state: "detached" });

  await desktopCtx.close();

  // =========================================================================
  // PART 3: MOBILE TOUCH EMULATION (390x844, USER-LEVEL DRAG + MULTI-TOUCH GUARD)
  // =========================================================================
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await attachMocks(mobileCtx);
  const mPage = await mobileCtx.newPage();
  mPage.setDefaultTimeout(10000);

  await mPage.goto(`${baseUrl}/novedades`);
  await mPage.getByRole("button", { name: "Sofia", exact: true }).tap();
  await mPage.locator(".story-stage").getByText("Sofia 1", { exact: true }).waitFor();
  await waitSettled(mPage);

  // Touch hold + right->left drag with secondary-finger noise -> jumps directly to Diego 1 (idx 5)
  await mPage.evaluate(async () => {
    const vpEl = document.querySelector(".story-cube-viewport");
    const rect = vpEl.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    const x0 = rect.left + rect.width * 0.75;
    const fire = (type, pointerId, isPrimary, clientX, clientY) => {
      vpEl.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId,
          isPrimary,
          pointerType: "touch",
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
          clientX,
          clientY,
        }),
      );
    };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    fire("pointerdown", 1, true, x0, y);
    await sleep(220);
    fire("pointerdown", 2, false, rect.left + 20, y);
    fire("pointermove", 2, false, rect.right - 20, y);
    fire("pointerup", 2, false, rect.right - 20, y);
    for (let i = 1; i <= 8; i++) {
      fire("pointermove", 1, true, x0 - (rect.width * 0.45 * i) / 8, y);
      await sleep(16);
    }
    fire("pointerup", 1, true, x0 - rect.width * 0.45, y);
  });
  await waitSettled(mPage);
  assert.equal(
    (await getActiveStoryState(mPage)).activeIndex,
    5,
    "Mobile touch right->left drag jumps to Diego 1",
  );

  // Touch drag LEFT -> RIGHT -> jumps directly back to Sofia 1 (idx 2)
  await mPage.evaluate(async () => {
    const vpEl = document.querySelector(".story-cube-viewport");
    const rect = vpEl.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    const x0 = rect.left + rect.width * 0.25;
    const fire = (type, clientX) => {
      vpEl.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 3,
          isPrimary: true,
          pointerType: "touch",
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
          clientX,
          clientY: y,
        }),
      );
    };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    fire("pointerdown", x0);
    await sleep(200);
    for (let i = 1; i <= 8; i++) {
      fire("pointermove", x0 + (rect.width * 0.45 * i) / 8);
      await sleep(16);
    }
    fire("pointerup", x0 + rect.width * 0.45);
  });
  await waitSettled(mPage);
  assert.equal(
    (await getActiveStoryState(mPage)).activeIndex,
    2,
    "Mobile touch left->right drag jumps to Sofia 1",
  );

  // Rapid repeated mobile user swipes (forward, forward, back, back): Sofia(2) -> Diego(5) -> Clara(8) -> Diego(5) -> Sofia(2)
  for (const dxSign of [-1, -1, 1, 1]) {
    await mPage.evaluate(async (sign) => {
      const vpEl = document.querySelector(".story-cube-viewport");
      const rect = vpEl.getBoundingClientRect();
      const y = rect.top + rect.height / 2;
      const x0 = sign < 0 ? rect.left + rect.width * 0.8 : rect.left + rect.width * 0.2;
      const x1 = x0 + sign * rect.width * 0.45;
      const pid = Math.floor(Math.random() * 1000) + 10;
      const fire = (type, clientX) => {
        vpEl.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: pid,
            isPrimary: true,
            pointerType: "touch",
            button: 0,
            buttons: type === "pointerup" ? 0 : 1,
            clientX,
            clientY: y,
          }),
        );
      };
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      fire("pointerdown", x0);
      await sleep(16);
      for (let i = 1; i <= 4; i++) {
        fire("pointermove", x0 + ((x1 - x0) * i) / 4);
        await sleep(10);
      }
      fire("pointerup", x1);
    }, dxSign);
    await mPage.waitForTimeout(80);
  }
  await waitSettled(mPage);
  assert.equal(
    (await getActiveStoryState(mPage)).activeIndex,
    2,
    "Rapid repeated mobile user swipes must settle cleanly back to Sofia 1 (idx 2)",
  );

  const selectedText = await mPage.evaluate(() => window.getSelection()?.toString() ?? "");
  assert.equal(selectedText, "", "Scrubbing must never trigger text selection");

  await mobileCtx.close();

  assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join("; ")}`);
  assert.deepEqual(consoleErrors, [], `Unexpected console errors: ${consoleErrors.join("; ")}`);
  console.log("story-navigation-browser: ok");
} finally {
  await browser.close();
}
