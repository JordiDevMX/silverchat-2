// Real Chromium verification for Instagram-style hold-drag 3D cube story navigation
// and the unified interruptible story transition engine (desktop mouse/keyboard + mobile touch + reduced motion).
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
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#2563eb"/><text x="200" y="300" fill="#fff" font-size="32" text-anchor="middle">Sofia Photo</text></svg>',
);

const uploads = [
  {
    id: photoUploadId,
    bucket: "story-media",
    path: `${sofia}/photo.svg`,
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

// Locked order: mine (Alice) -> unwatched newest-first (Sofia, Diego) -> watched (Clara).
// Timeline indices:
// 0: Mine 1 (Alice)
// 1: Sofia 1 (Sofia, text)
// 2: Sofia Photo (Sofia, image)
// 3: Diego 1 (Diego, text)
// 4: Diego 2 (Diego, text)
// 5: Clara 1 (Clara, text, already viewed)
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
    created_at: new Date(baseTs - 60_000).toISOString(),
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
    created_at: new Date(baseTs - 20_000).toISOString(),
    expires_at: future,
  },
  {
    id: uid(21),
    user_id: sofia,
    media_type: "image",
    text_content: null,
    background_color: null,
    caption: "Sofia Photo Caption",
    file_upload_id: photoUploadId,
    media_thumbnail_upload_id: null,
    created_at: new Date(baseTs - 10_000).toISOString(),
    expires_at: future,
  },
  {
    id: uid(30),
    user_id: diego,
    media_type: "text",
    text_content: "Diego 1",
    background_color: "#7c3aed",
    caption: null,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    created_at: new Date(baseTs - 40_000).toISOString(),
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
    created_at: new Date(baseTs - 30_000).toISOString(),
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
    created_at: new Date(baseTs - 90_000).toISOString(),
    expires_at: future,
  },
];

const views = [{ story_id: uid(40), viewer_id: me }];
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
      if (key === `story-media/${sofia}/photo.svg`) {
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
      return {
        index: Number(el.getAttribute("data-story-index")),
        id: el.getAttribute("data-story-id"),
        active: el.getAttribute("data-story-active") === "true",
        visibility: el.style.visibility,
        transform: el.style.transform,
        opacity: Number(el.style.opacity || "1"),
        shadeOpacity: Number(shade?.style.opacity || "0"),
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
  // PART 1: DESKTOP MOUSE + KEYBOARD FLOWS
  // =========================================================================
  const desktopCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await attachMocks(desktopCtx);
  const page = await desktopCtx.newPage();
  page.setDefaultTimeout(10000);

  await page.goto(`${baseUrl}/novedades`);
  await page.getByRole("button", { name: "Sofia", exact: true }).click();
  await page.locator(".story-stage").getByText("Sofia 1", { exact: true }).waitFor();
  await waitSettled(page);

  // 1. Verify adjacent image story ("Sofia Photo", idx 2) is ALREADY preloaded in DOM before any drag.
  await page.waitForFunction(() => {
    const img = document.querySelector('.story-cube-face[data-story-index="2"] img');
    return Boolean(img?.complete && img.naturalWidth > 0);
  });
  await page.evaluate(() => {
    const img = document.querySelector('.story-cube-face[data-story-index="2"] img');
    img.__persistedNodeTag = "sofia-photo-stable";
  });

  const vp = await page.locator(".story-cube-viewport").boundingBox();
  assert.ok(vp && vp.width > 200, "Viewport must render");
  const cx = vp.x + vp.width / 2;
  const cy = vp.y + vp.height / 2;

  // 2. Press and hold (without dragging): pauses progress bar, hides chrome, release restores & never taps.
  await page.mouse.move(cx - 90, cy); // left 30% zone to also prove hold does NOT trigger tap-left!
  await page.mouse.down();
  await page.waitForTimeout(260);
  const whileHeld = await getActiveStoryState(page);
  assert.equal(whileHeld.holding, true, "Hold must enter holding state");
  assert.equal(whileHeld.chromeHidden, true, "Hold must hide overlay chrome");
  const chromeOpacity = await page.evaluate(() => ({
    header: Number(getComputedStyle(document.querySelector(".story-viewer-header")).opacity),
    footer: Number(getComputedStyle(document.querySelector(".story-viewer footer")).opacity),
  }));
  // Wait for 160ms opacity transition to finish
  await page.waitForTimeout(220);
  const chromeOpacityAfter = await page.evaluate(() => ({
    header: Number(getComputedStyle(document.querySelector(".story-viewer-header")).opacity),
    footer: Number(getComputedStyle(document.querySelector(".story-viewer footer")).opacity),
  }));
  assert.ok(
    chromeOpacityAfter.header < 0.05 && chromeOpacityAfter.footer < 0.05,
    `Chrome must fade out on hold, got ${JSON.stringify({ chromeOpacity, chromeOpacityAfter })}`,
  );

  const progressFrozen1 = await page.locator(".story-progress").innerHTML();
  await page.waitForTimeout(450);
  assert.equal(
    await page.locator(".story-progress").innerHTML(),
    progressFrozen1,
    "Timer must stay paused while held",
  );

  await page.mouse.up();
  await page.waitForTimeout(250);
  const afterHoldRelease = await getActiveStoryState(page);
  assert.equal(
    afterHoldRelease.activeIndex,
    1,
    "Releasing a hold without drag must NOT trigger tap navigation",
  );
  assert.equal(afterHoldRelease.chromeHidden, false, "Releasing hold must restore overlay chrome");
  const progressResumed = await page.locator(".story-progress").innerHTML();
  assert.notEqual(progressResumed, progressFrozen1, "Timer must resume after releasing hold");

  // 3. Hold + drag RIGHT -> NEXT with LIVE 3D cube preview + zero remount of preloaded image!
  await page.mouse.move(cx - 80, cy);
  await page.mouse.down();
  await page.waitForTimeout(210);
  await page.mouse.move(cx - 80 + vp.width * 0.45, cy, { steps: 12 });
  const midRightDrag = await getActiveStoryState(page);
  assert.equal(midRightDrag.dragging, true, "Horizontal drag must enter dragging state");
  assert.equal(midRightDrag.chromeHidden, true, "Chrome must stay hidden during drag");
  const currFaceRight = midRightDrag.faces.find((f) => f.index === 1);
  const nextFaceRight = midRightDrag.faces.find((f) => f.index === 2);
  assert.equal(currFaceRight?.visibility, "visible", "Current face must stay visible mid-drag");
  assert.equal(
    nextFaceRight?.visibility,
    "visible",
    "Incoming NEXT face must be visible live mid-drag",
  );
  assert.ok(
    extractRotateY(currFaceRight.transform) > 20,
    `Current face must rotate +Y when dragging right, got ${currFaceRight.transform}`,
  );
  assert.ok(
    extractRotateY(nextFaceRight.transform) < -20,
    `Incoming NEXT face must rotate -Y from left, got ${nextFaceRight.transform}`,
  );
  assert.ok(
    currFaceRight.shadeOpacity > 0.05 && nextFaceRight.shadeOpacity > 0.05,
    "3D shading must be active mid-drag",
  );

  // Release past threshold -> commits to Sofia Photo (idx 2) without remounting the <img>!
  await page.mouse.up();
  await waitSettled(page);
  const settledPhoto = await getActiveStoryState(page);
  assert.equal(
    settledPhoto.activeIndex,
    2,
    "Drag right >27% must commit to NEXT story (Sofia Photo)",
  );
  assert.equal(settledPhoto.chromeHidden, false, "Chrome must restore after commit");
  const imgPreserved = await page.evaluate(
    () => document.querySelector(".story-stage img")?.__persistedNodeTag === "sofia-photo-stable",
  );
  assert.equal(
    imgPreserved,
    true,
    "Preloaded adjacent <img> MUST NOT remount when promoted to active",
  );

  // 4. Spring-back below threshold (drag RIGHT slowly ~15%, pause so velocity = 0, release -> stays at idx 2)
  await dragMouse(page, cx, cy, cx + vp.width * 0.15, cy, {
    steps: 8,
    holdBeforeMs: 200,
    holdAfterMs: 120,
  });
  await waitSettled(page);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    2,
    "Slow sub-threshold right drag must spring back",
  );

  // 5. Hold + drag LEFT -> PREVIOUS with live 3D cube preview -> commits back to Sofia 1 (idx 1)
  await page.mouse.move(cx + 80, cy);
  await page.mouse.down();
  await page.waitForTimeout(210);
  await page.mouse.move(cx + 80 - vp.width * 0.45, cy, { steps: 12 });
  const midLeftDrag = await getActiveStoryState(page);
  const currFaceLeft = midLeftDrag.faces.find((f) => f.index === 2);
  const prevFaceLeft = midLeftDrag.faces.find((f) => f.index === 1);
  assert.equal(
    prevFaceLeft?.visibility,
    "visible",
    "Incoming PREVIOUS face must be visible live mid-drag",
  );
  assert.ok(
    extractRotateY(currFaceLeft.transform) < -20,
    `Current face must rotate -Y when dragging left, got ${currFaceLeft.transform}`,
  );
  assert.ok(
    extractRotateY(prevFaceLeft.transform) > 20,
    `Incoming PREVIOUS face must rotate +Y from right, got ${prevFaceLeft.transform}`,
  );
  await page.mouse.up();
  await waitSettled(page);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    1,
    "Drag left >27% must commit to PREVIOUS story",
  );

  // 6. Velocity flings: short distance (~16% width) + fast flick -> commits!
  await dragMouse(page, cx, cy, cx + vp.width * 0.16, cy, {
    steps: 3,
    holdBeforeMs: 0,
    holdAfterMs: 0,
  });
  await waitSettled(page);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    2,
    "Fast right fling must commit to NEXT",
  );

  await dragMouse(page, cx, cy, cx - vp.width * 0.16, cy, {
    steps: 3,
    holdBeforeMs: 0,
    holdAfterMs: 0,
  });
  await waitSettled(page);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    1,
    "Fast left fling must commit to PREVIOUS",
  );

  // 7. Cross-user navigation: Sofia 1 (1) -> Sofia Photo (2) -> Diego 1 (3) -> Diego 2 (4) -> Clara 1 (5)
  // Quick tap right (70% zone) routes through the unified 3D cube transition!
  await page.mouse.click(vp.x + vp.width * 0.75, cy);
  await page.waitForTimeout(40);
  const midTap = await getActiveStoryState(page);
  assert.equal(midTap.activeIndex, 2, "Quick tap right must advance to Sofia Photo");
  assert.equal(midTap.settling, true, "Quick tap must animate through unified settling engine");
  assert.ok(
    midTap.faces.some((f) => Math.abs(extractRotateY(f.transform)) > 2),
    `Quick tap must run 3D cube rotation, got ${JSON.stringify(midTap.faces)}`,
  );
  await waitSettled(page);

  // Drag right across user boundary: Sofia Photo (2) -> Diego 1 (3)
  await dragMouse(page, cx - 60, cy, cx - 60 + vp.width * 0.42, cy, {
    steps: 10,
    holdBeforeMs: 200,
  });
  await waitSettled(page);
  const atDiego1 = await getActiveStoryState(page);
  assert.equal(atDiego1.activeIndex, 3);
  assert.equal(atDiego1.headerName, "Diego");
  assert.equal(atDiego1.segments, 2);
  assert.equal(atDiego1.stageText, "Diego 1");

  // Verify adjacent video story (idx 4) is preloaded, muted & paused while Diego 1 (idx 3) is active.
  await page.waitForFunction(() => {
    const v = document.querySelector('.story-cube-face[data-story-index="4"] video');
    return Boolean(v && v.readyState >= 1);
  });
  const preloadedVideoState = await page.evaluate(() => {
    const v = document.querySelector('.story-cube-face[data-story-index="4"] video');
    v.__persistedVideoTag = "diego-video-stable";
    return { muted: v.muted, paused: v.paused };
  });
  assert.equal(preloadedVideoState.muted, true, "Adjacent preloaded video must stay muted");
  assert.equal(preloadedVideoState.paused, true, "Adjacent preloaded video must stay paused");

  // Keyboard ArrowRight -> Diego Video (4) without remounting <video>, unmuted on promotion!
  await page.keyboard.press("ArrowRight");
  await waitSettled(page);
  assert.equal((await getActiveStoryState(page)).activeIndex, 4);
  const activeVideoState = await page.evaluate(() => {
    const v = document.querySelector(".story-stage video");
    return { tag: v?.__persistedVideoTag ?? null, muted: v?.muted ?? true };
  });
  assert.equal(
    activeVideoState.tag,
    "diego-video-stable",
    "Preloaded adjacent <video> MUST NOT remount when promoted to active",
  );
  assert.equal(activeVideoState.muted, false, "Active video must unmute on promotion");

  // Typing ArrowLeft inside reply input must NOT navigate away!
  const replyInput = page.getByRole("textbox", { name: "Reply to story" });
  await replyInput.click();
  await replyInput.fill("Hey");
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(150);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    4,
    "ArrowLeft inside reply input must not navigate",
  );
  await replyInput.fill("");
  await page.locator(".story-viewer-header").click(); // blur input

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await waitSettled(page);
  const atClara = await getActiveStoryState(page);
  assert.equal(atClara.activeIndex, 5);
  assert.equal(atClara.headerName, "Clara");
  assert.equal(atClara.segments, 1);

  // 8. Boundary rubber-band resistance at LAST story (idx 5): drag RIGHT strongly -> bounded resistance & spring back
  await page.mouse.move(cx - 100, cy);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.move(cx - 100 + vp.width * 0.75, cy, { steps: 10 });
  const lastBound = await getActiveStoryState(page);
  const lastAngle = extractRotateY(lastBound.faces.find((f) => f.index === 5)?.transform ?? "");
  assert.ok(
    lastAngle > 3 && lastAngle < 30,
    `Last-story boundary must apply rubber-band resistance (0 < deg < 30), got ${lastAngle}`,
  );
  await page.mouse.up();
  await waitSettled(page);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    5,
    "Releasing at last-story boundary must spring back, not close or break",
  );

  // 9. Mid-transition interruption & retargeting:
  // Start ArrowLeft (5 -> 4), after 50ms immediately ArrowLeft again -> retargets smoothly to 3 (Diego 1)
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(50);
  await page.keyboard.press("ArrowLeft");
  await waitSettled(page);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    3,
    "Double mid-flight ArrowLeft must retarget smoothly to idx 3",
  );

  // Start ArrowRight (3 -> 4), catch mid-flight with pointerdown, drag LEFT back toward 3 and release!
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(60);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const caught = await getActiveStoryState(page);
  assert.equal(caught.settling, false, "Pointerdown must immediately interrupt settling animation");
  await page.mouse.move(cx - vp.width * 0.35, cy, { steps: 8 });
  await page.mouse.up();
  await waitSettled(page);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    3,
    "Catching mid-flight and dragging back left must settle cleanly on idx 3",
  );

  // Navigate to FIRST story (Mine 1, idx 0) via rapid left taps & check FIRST boundary rubber-band
  await page.mouse.click(vp.x + vp.width * 0.15, cy);
  await page.waitForTimeout(45);
  await page.mouse.click(vp.x + vp.width * 0.15, cy);
  await page.waitForTimeout(45);
  await page.mouse.click(vp.x + vp.width * 0.15, cy);
  await waitSettled(page);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    0,
    "Rapid left taps must chain cleanly to Mine 1 (idx 0)",
  );

  await page.mouse.move(cx + 100, cy);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.move(cx + 100 - vp.width * 0.75, cy, { steps: 10 });
  const firstBound = await getActiveStoryState(page);
  const firstAngle = extractRotateY(firstBound.faces.find((f) => f.index === 0)?.transform ?? "");
  assert.ok(
    firstAngle < -3 && firstAngle > -30,
    `First-story boundary must apply rubber-band resistance (-30 < deg < 0), got ${firstAngle}`,
  );
  await page.mouse.up();
  await waitSettled(page);
  assert.equal((await getActiveStoryState(page)).activeIndex, 0);

  // 10. Auto-advance routes through the unified cube transition (Mine 1 -> Sofia 1 after 5s)
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
    .getByText("Sofia 1", { exact: true })
    .waitFor({ timeout: 7500 });
  await waitSettled(page);
  assert.equal(
    sawAutoAdvanceCube,
    true,
    "Timer auto-advance must route through the unified cube transition",
  );

  // 11. Swipe-down dismiss still closes the viewer cleanly
  await dragMouse(page, cx, cy - 50, cx, cy + 120, { steps: 8, holdBeforeMs: 0 });
  await page.getByRole("dialog", { name: "Story", exact: true }).waitFor({ state: "detached" });

  // 12. Rapid open/close cycles + tap-next at absolute last story closes viewer
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Clara", exact: true }).click();
    await page.locator(".story-stage").getByText("Clara 1", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Close story", exact: true }).click();
    await page.getByRole("dialog", { name: "Story", exact: true }).waitFor({ state: "detached" });
  }
  await page.getByRole("button", { name: "Clara", exact: true }).click();
  await page.locator(".story-stage").getByText("Clara 1", { exact: true }).waitFor();
  const vpLast = await page.locator(".story-cube-viewport").boundingBox();
  await page.mouse.click(vpLast.x + vpLast.width * 0.75, vpLast.y + vpLast.height / 2);
  await page.getByRole("dialog", { name: "Story", exact: true }).waitFor({ state: "detached" });

  // =========================================================================
  // PART 2: REDUCED MOTION CROSSFADE FALLBACK
  // =========================================================================
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Sofia", exact: true }).click();
  await page.locator(".story-stage").getByText("Sofia 1", { exact: true }).waitFor();
  await waitSettled(page);
  const vpRm = await page.locator(".story-cube-viewport").boundingBox();
  const rmCx = vpRm.x + vpRm.width / 2;
  const rmCy = vpRm.y + vpRm.height / 2;
  await page.mouse.move(rmCx - 60, rmCy);
  await page.mouse.down();
  await page.waitForTimeout(210);
  await page.mouse.move(rmCx - 60 + vpRm.width * 0.45, rmCy, { steps: 10 });
  const rmDrag = await getActiveStoryState(page);
  assert.equal(rmDrag.reducedMotion, true, "Viewer must detect prefers-reduced-motion: reduce");
  const rmCurr = rmDrag.faces.find((f) => f.index === 1);
  const rmNext = rmDrag.faces.find((f) => f.index === 2);
  assert.equal(rmCurr?.transform, "none", "Reduced motion must not apply 3D transforms");
  assert.equal(
    rmNext?.transform,
    "none",
    "Reduced motion incoming face must not apply 3D transforms",
  );
  assert.ok(
    rmCurr.opacity > 0.2 && rmCurr.opacity < 0.85,
    `Expected crossfade opacity on current face, got ${rmCurr.opacity}`,
  );
  assert.ok(
    rmNext.opacity > 0.15 && rmNext.opacity < 0.8,
    `Expected crossfade opacity on incoming face, got ${rmNext.opacity}`,
  );
  assert.equal(rmCurr.shadeOpacity, 0, "Reduced motion must disable 3D shading");
  await page.mouse.up();
  await waitSettled(page);
  assert.equal(
    (await getActiveStoryState(page)).activeIndex,
    2,
    "Reduced motion drag right must still commit NEXT",
  );
  await page.getByRole("button", { name: "Close story", exact: true }).click();
  await page.getByRole("dialog", { name: "Story", exact: true }).waitFor({ state: "detached" });

  await desktopCtx.close();

  // =========================================================================
  // PART 3: MOBILE TOUCH EMULATION (390x844, pointerType: "touch" + multi-touch guard)
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

  // Exercise touch hold + right drag + multi-touch secondary finger ignored cleanly!
  await mPage.evaluate(async () => {
    const vpEl = document.querySelector(".story-cube-viewport");
    const rect = vpEl.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    const x0 = rect.left + rect.width * 0.25;
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
    // Secondary finger tries to drag left — must be ignored!
    fire("pointerdown", 2, false, rect.right - 20, y);
    fire("pointermove", 2, false, rect.left + 20, y);
    fire("pointerup", 2, false, rect.left + 20, y);
    // Primary finger drags RIGHT 45% width -> commits NEXT (idx 2)
    for (let i = 1; i <= 8; i++) {
      fire("pointermove", 1, true, x0 + (rect.width * 0.45 * i) / 8, y);
      await sleep(16);
    }
    fire("pointerup", 1, true, x0 + rect.width * 0.45, y);
  });
  await waitSettled(mPage);
  const mAfterRight = await getActiveStoryState(mPage);
  assert.equal(
    mAfterRight.activeIndex,
    2,
    "Mobile touch drag right with secondary finger noise must commit NEXT",
  );

  // Mobile touch drag LEFT -> returns to PREVIOUS (idx 1)
  await mPage.evaluate(async () => {
    const vpEl = document.querySelector(".story-cube-viewport");
    const rect = vpEl.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    const x0 = rect.left + rect.width * 0.75;
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
      fire("pointermove", x0 - (rect.width * 0.45 * i) / 8);
      await sleep(16);
    }
    fire("pointerup", x0 - rect.width * 0.45);
  });
  await waitSettled(mPage);
  assert.equal(
    (await getActiveStoryState(mPage)).activeIndex,
    1,
    "Mobile touch drag left must commit PREVIOUS",
  );

  // Rapid repeated mobile swipes (right -> right -> left -> left) must stay clean & consistent
  for (const dir of [1, 1, -1, -1]) {
    await mPage.evaluate(async (direction) => {
      const vpEl = document.querySelector(".story-cube-viewport");
      const rect = vpEl.getBoundingClientRect();
      const y = rect.top + rect.height / 2;
      const x0 = direction > 0 ? rect.left + rect.width * 0.2 : rect.left + rect.width * 0.8;
      const x1 = x0 + direction * rect.width * 0.45;
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
    }, dir);
    await mPage.waitForTimeout(80);
  }
  await waitSettled(mPage);
  assert.equal(
    (await getActiveStoryState(mPage)).activeIndex,
    1,
    "Rapid repeated swipes must settle cleanly back to idx 1 without state corruption",
  );

  // Verify zero accidental text selection during touch scrubbing
  const selectedText = await mPage.evaluate(() => window.getSelection()?.toString() ?? "");
  assert.equal(selectedText, "", "Scrubbing must never trigger text selection");

  await mobileCtx.close();

  assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join("; ")}`);
  assert.deepEqual(consoleErrors, [], `Unexpected console errors: ${consoleErrors.join("; ")}`);
  console.log("story-navigation-browser: ok");
} finally {
  await browser.close();
}
