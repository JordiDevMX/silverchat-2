// Real browser verification for swipe-right-to-reply gesture physics, conflicts, and accessibility.
import assert from "node:assert/strict";
import { launchBrowser } from "./lib/browser.mjs";

const browser = await launchBrowser({
  args: ["--no-sandbox"],
});

const uid = (n) => `${String(n).padStart(8, "0")}-3333-4333-8333-333333333333`;
const me = uid(1);
const other = uid(2);
const chatId = uid(100);

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
const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(
  JSON.stringify({ sub: me, aal: "aal2", exp: Math.floor(Date.now() / 1000) + 3600 }),
).toString("base64url")}.signature`;
const ago = (n) => new Date(Date.now() - n * 60000).toISOString();

const makeUpload = (id, patch = {}) => ({
  id,
  owner_id: other,
  chat_id: chatId,
  bucket: "chat-media",
  path: `${chatId}/${id}`,
  original_filename: "sample.bin",
  mime_type: "image/png",
  size_bytes: 1024,
  width: 320,
  height: 240,
  duration_seconds: null,
  status: "completed",
  created_at: ago(5),
  ...patch,
});

const imgUpload = makeUpload(uid(701), { original_filename: "photo.png", mime_type: "image/png" });
const vidPoster = makeUpload(uid(702), { original_filename: "poster.png", mime_type: "image/png" });
const vidUpload = makeUpload(uid(703), {
  original_filename: "clip.mp4",
  mime_type: "video/mp4",
  duration_seconds: 8,
});
const audioUpload = makeUpload(uid(704), {
  original_filename: "voice.webm",
  mime_type: "audio/webm",
  duration_seconds: 12,
});
const fileUpload = makeUpload(uid(705), {
  original_filename: "report.pdf",
  mime_type: "application/pdf",
  size_bytes: 4096,
});
const stickerUpload = makeUpload(uid(706), {
  original_filename: "sticker.webp",
  mime_type: "image/webp",
});
const uploads = [imgUpload, vidPoster, vidUpload, audioUpload, fileUpload, stickerUpload];

const makeMsg = (n, patch = {}) => ({
  id: uid(1000 + n),
  chat_id: chatId,
  sender_id: other,
  type: "text",
  content: `Message ${n}`,
  created_at: ago(100 - n),
  deleted_for_everyone: false,
  file_upload_id: null,
  media_thumbnail_upload_id: null,
  media_peaks: null,
  mentions: null,
  location_data: null,
  contact_data: null,
  ...patch,
});

const filler = Array.from({ length: 30 }, (_, i) =>
  makeMsg(i + 1, {
    sender_id: i % 2 === 0 ? other : me,
    content: `History line ${i + 1}: enough text to scroll vertically across the chat`,
  }),
);

const typedMessages = [
  makeMsg(101, { sender_id: other, type: "text", content: "Incoming hello world" }),
  makeMsg(102, { sender_id: me, type: "text", content: "Outgoing hello world" }),
  makeMsg(103, {
    sender_id: other,
    type: "image",
    content: null,
    file_upload_id: imgUpload.id,
  }),
  makeMsg(104, {
    sender_id: other,
    type: "video",
    content: null,
    file_upload_id: vidUpload.id,
    media_thumbnail_upload_id: vidPoster.id,
  }),
  makeMsg(105, {
    sender_id: other,
    type: "audio",
    content: null,
    file_upload_id: audioUpload.id,
    media_peaks: Array.from({ length: 40 }, (_, i) => 20 + (i % 50)),
  }),
  makeMsg(106, {
    sender_id: other,
    type: "file",
    content: null,
    file_upload_id: fileUpload.id,
  }),
  makeMsg(107, {
    sender_id: other,
    type: "sticker",
    content: null,
    file_upload_id: stickerUpload.id,
  }),
  makeMsg(108, {
    sender_id: other,
    type: "location",
    content: null,
    location_data: { latitude: 19.4326, longitude: -99.1332 },
  }),
  makeMsg(109, {
    sender_id: other,
    type: "contact",
    content: null,
    contact_data: { user_id: other, display_name: "Sofia Reyes", username: "sofia" },
  }),
  makeMsg(110, {
    sender_id: other,
    type: "text",
    content: "Deleted content",
    deleted_for_everyone: true,
  }),
  makeMsg(111, {
    sender_id: other,
    type: "system",
    content: "System notice",
  }),
];

const rows = [...filler, ...typedMessages];

const response = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function setup(context) {
  await context.route("https://cdn.jsdelivr.net/npm/emojibase-data@*/**", (r) => r.abort());
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
    const req = route.request();
    const url = new URL(req.url());
    const s = url.searchParams;
    const p = url.pathname;
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
      return result([
        {
          id: chatId,
          type: "direct",
          name: null,
          status: "active",
          avatar_url: null,
          community_id: null,
        },
      ]);
    }
    if (p.endsWith("/chat_members")) {
      return result([
        {
          chat_id: chatId,
          user_id: me,
          role: "member",
          joined_at: "2020-01-01T00:00:00Z",
          manually_unread: false,
        },
        {
          chat_id: chatId,
          user_id: other,
          role: "member",
          joined_at: "2020-01-01T00:00:00Z",
          manually_unread: false,
        },
      ]);
    }
    if (p.endsWith("/chat_requests") || p.endsWith("/message_reactions")) return result([]);
    if (p.endsWith("/message_receipts")) return result([]);
    if (p.endsWith("/file_uploads")) {
      return result(uploads.filter((u) => !s.get("id") || s.get("id").includes(u.id)));
    }
    if (req.method() === "POST" && p.includes("/storage/v1/object/sign/")) {
      return response(route, { signedURL: "/object/sign/chat-media/sample.png?token=signed" });
    }
    if (p.includes("/storage/v1/object/")) {
      return route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    }
    if (p.endsWith("/messages")) {
      return result(rows.filter((m) => !s.get("id") || s.get("id").includes(m.id)));
    }
    if (p.includes("/rpc/get_chat_messages")) {
      const data = [...rows].sort(
        (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
      );
      return response(route, data);
    }
    return response(route, null);
  });
  await context.routeWebSocket("**/realtime/v1/websocket**", (socket) =>
    socket.onMessage((raw) => {
      const [join, ref, topic, event, payload] = JSON.parse(String(raw));
      if (event === "phx_join") {
        const config = (payload.config.postgres_changes ?? []).map((c, i) => ({ ...c, id: i + 1 }));
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
      if (event === "heartbeat") {
        socket.send(
          JSON.stringify([join, ref, topic, "phx_reply", { status: "ok", response: {} }]),
        );
      }
    }),
  );
}

const baseUrl = process.env.UI_BASE_URL ?? process.env.TEST_BASE_URL ?? "http://127.0.0.1:5173";
const errors = [];

const cdpSwipe = async (cdp, startX, startY, endX, endY, { steps = 8, cancel = false } = {}) => {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: startX, y: startY, id: 1 }],
  });
  for (let i = 1; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps;
    const y = startY + ((endY - startY) * i) / steps;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y, id: 1 }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: cancel ? "touchCancel" : "touchEnd",
    touchPoints: [],
  });
};

const getRowTranslateX = (page, msgId) =>
  page.evaluate((id) => {
    const el = document.querySelector(`[data-message-id="${id}"] .message-swipe-track`);
    if (!el) return 0;
    const t = getComputedStyle(el).transform;
    return t && t !== "none" ? new DOMMatrix(t).m41 : 0;
  }, msgId);

const waitRowRest = (page, msgId) =>
  page.waitForFunction((id) => {
    const el = document.querySelector(`[data-message-id="${id}"] .message-swipe-track`);
    if (!el) return false;
    const t = el.style.transform;
    return !t || t === "none";
  }, msgId);

const bubble = (page, id) => page.locator(`[data-message-id="${id}"]`);

try {
  // 1. Mobile touch tests (390x844)
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await setup(mobileCtx);
  const page = await mobileCtx.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.message));

  await page.addInitScript(() => {
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });

  await page.goto(`${baseUrl}/chats/${chatId}`);
  await page.locator(".message-list").waitFor();
  await page.waitForTimeout(300);
  const cdp = await mobileCtx.newCDPSession(page);

  const incomingText = typedMessages[0];
  const outgoingText = typedMessages[1];
  const imageMsg = typedMessages[2];
  const videoMsg = typedMessages[3];
  const audioMsg = typedMessages[4];
  const fileMsg = typedMessages[5];
  const stickerMsg = typedMessages[6];
  const locationMsg = typedMessages[7];
  const contactMsg = typedMessages[8];
  const deletedMsg = typedMessages[9];
  const systemMsg = typedMessages[10];

  // A. Sub-threshold release returns to rest with no reply or haptic
  await bubble(page, incomingText.id).scrollIntoViewIfNeeded();
  let box = await bubble(page, incomingText.id).locator(".message-bubble").boundingBox();
  await cdpSwipe(cdp, box.x + 20, box.y + box.height / 2, box.x + 50, box.y + box.height / 2);
  await waitRowRest(page, incomingText.id);
  assert.equal(await page.locator(".reply-bar").count(), 0);
  assert.equal((await page.evaluate(() => window.__vibrateCalls)).length, 0);

  // B. Leftward swipe does not travel or trigger reply
  await cdpSwipe(cdp, box.x + 120, box.y + box.height / 2, box.x + 20, box.y + box.height / 2);
  assert.equal(await getRowTranslateX(page, incomingText.id), 0);
  assert.equal(await page.locator(".reply-bar").count(), 0);

  // C. Crossing threshold arms indicator + triggers one-shot haptic + bounded travel, release enters reply mode & focuses composer
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + 20, y: box.y + box.height / 2, id: 1 }],
  });
  for (let i = 1; i <= 12; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: box.x + 20 + i * 20, y: box.y + box.height / 2, id: 1 }],
    });
  }
  const armedTravel = await getRowTranslateX(page, incomingText.id);
  assert.ok(
    armedTravel >= 48 && armedTravel < 84,
    `Expected bounded armed travel in [48, 84), got ${armedTravel}`,
  );
  assert.equal(
    await bubble(page, incomingText.id)
      .locator(".message-swipe-indicator")
      .getAttribute("data-armed"),
    "true",
  );
  assert.equal((await page.evaluate(() => window.__vibrateCalls)).length, 1);

  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.locator(".reply-bar").getByText("Sofia Reyes").waitFor();
  await page.locator(".reply-bar").getByText(incomingText.content).waitFor();
  assert.equal(
    await page.evaluate(() => document.activeElement?.matches(".composer-input textarea")),
    true,
  );
  await waitRowRest(page, incomingText.id);
  await page.getByRole("button", { name: "Cancel reply" }).click();

  // D. Cancelled gesture (touchCancel) while armed must NOT trigger reply
  box = await bubble(page, outgoingText.id).locator(".message-bubble").boundingBox();
  await cdpSwipe(cdp, box.x + 20, box.y + box.height / 2, box.x + 180, box.y + box.height / 2, {
    cancel: true,
  });
  await waitRowRest(page, outgoingText.id);
  assert.equal(await page.locator(".reply-bar").count(), 0);

  // E. Outgoing message swipe-to-reply works cleanly
  await cdpSwipe(cdp, box.x + 20, box.y + box.height / 2, box.x + 180, box.y + box.height / 2);
  await page.locator(".reply-bar").getByText("Alice Rivera").waitFor();
  await page.locator(".reply-bar").getByText(outgoingText.content).waitFor();
  await waitRowRest(page, outgoingText.id);
  await page.getByRole("button", { name: "Cancel reply" }).click();

  // F. All other message types (image without opening lightbox, video, audio, file, sticker, location, contact)
  const expectedTypeLabels = [
    [imageMsg.id, "📷 Photo"],
    [videoMsg.id, "🎥 Video"],
    [audioMsg.id, "🎤 Audio"],
    [fileMsg.id, "📄 File"],
    [stickerMsg.id, "Sticker"],
    [locationMsg.id, "Location"],
    [contactMsg.id, "Contact"],
  ];
  for (const [id, label] of expectedTypeLabels) {
    await bubble(page, id).scrollIntoViewIfNeeded();
    const targetBox = await bubble(page, id).locator(".message-bubble").boundingBox();
    await cdpSwipe(
      cdp,
      targetBox.x + 20,
      targetBox.y + targetBox.height / 2,
      targetBox.x + 180,
      targetBox.y + targetBox.height / 2,
    );
    await page.locator(".reply-bar").getByText(label).waitFor();
    assert.equal(
      await page.locator("dialog.media-lightbox[open]").count(),
      0,
      `Swiping ${label} must not open lightbox`,
    );
    await waitRowRest(page, id);
    await page.getByRole("button", { name: "Cancel reply" }).click();
  }

  // G. Tap on ImageMessage STILL opens MediaLightbox
  await bubble(page, imageMsg.id).evaluate((el) =>
    el.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await bubble(page, imageMsg.id).locator("img").waitFor();
  await bubble(page, imageMsg.id).getByRole("button", { name: "Open image" }).tap();
  await page.locator("dialog.media-lightbox[open]").waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).tap();
  await page.locator("dialog.media-lightbox[open]").waitFor({ state: "detached" });

  // H. Audio seek slider drag does NOT swipe row to reply
  await bubble(page, audioMsg.id).scrollIntoViewIfNeeded();
  const sliderBox = await bubble(page, audioMsg.id).locator(".voice-track input").boundingBox();
  await cdpSwipe(
    cdp,
    sliderBox.x + 10,
    sliderBox.y + sliderBox.height / 2,
    sliderBox.x + 130,
    sliderBox.y + sliderBox.height / 2,
  );
  assert.equal(await page.locator(".reply-bar").count(), 0);
  assert.equal(await getRowTranslateX(page, audioMsg.id), 0);

  // I. Vertical drag scrolls .message-list natively without triggering swipe
  await bubble(page, incomingText.id).scrollIntoViewIfNeeded();
  const scrollBefore = await page.locator(".message-list").evaluate((el) => el.scrollTop);
  const vBox = await bubble(page, incomingText.id).locator(".message-bubble").boundingBox();
  await cdpSwipe(cdp, vBox.x + vBox.width / 2, vBox.y + 10, vBox.x + vBox.width / 2, vBox.y + 160, {
    steps: 10,
  });
  await page.waitForTimeout(150);
  const scrollAfter = await page.locator(".message-list").evaluate((el) => el.scrollTop);
  assert.notEqual(scrollAfter, scrollBefore, "Vertical touch drag must scroll message list");
  assert.equal(await page.locator(".reply-bar").count(), 0);

  // J. Long-press context menu still works on touch
  await bubble(page, incomingText.id).evaluate((el) =>
    el.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  const lpBox = await bubble(page, incomingText.id).locator(".message-bubble").boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: lpBox.x + 25, y: lpBox.y + 15, id: 1 }],
  });
  await page.getByRole("menu", { name: "Message actions" }).waitFor();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.getByRole("menuitem", { name: "Reply", exact: true }).tap();
  await page.locator(".reply-bar").getByText(incomingText.content).waitFor();
  await page.getByRole("button", { name: "Cancel reply" }).click();

  // K. Deleted and system messages do not swipe-to-reply
  for (const id of [deletedMsg.id, systemMsg.id]) {
    await bubble(page, id).scrollIntoViewIfNeeded();
    const dBox = await bubble(page, id).boundingBox();
    await cdpSwipe(
      cdp,
      dBox.x + 20,
      dBox.y + dBox.height / 2,
      dBox.x + 180,
      dBox.y + dBox.height / 2,
    );
    assert.equal(await page.locator(".reply-bar").count(), 0);
  }

  // L. Single in-flight guard: second message cannot move while first is actively held
  await bubble(page, incomingText.id).scrollIntoViewIfNeeded();
  const b1 = await bubble(page, incomingText.id).locator(".message-bubble").boundingBox();
  const b2 = await bubble(page, outgoingText.id).locator(".message-bubble").boundingBox();
  await page.evaluate(
    ({ id1, id2, b1, b2 }) => {
      const r1 = document.querySelector(`[data-message-id="${id1}"]`);
      const r2 = document.querySelector(`[data-message-id="${id2}"]`);
      r1.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 10,
          isPrimary: true,
          pointerType: "touch",
          clientX: b1.x + 20,
          clientY: b1.y + 15,
        }),
      );
      r1.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 10,
          isPrimary: true,
          pointerType: "touch",
          clientX: b1.x + 70,
          clientY: b1.y + 15,
        }),
      );
      r2.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 11,
          isPrimary: true,
          pointerType: "touch",
          clientX: b2.x + 20,
          clientY: b2.y + 15,
        }),
      );
      r2.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 11,
          isPrimary: true,
          pointerType: "touch",
          clientX: b2.x + 160,
          clientY: b2.y + 15,
        }),
      );
    },
    { id1: incomingText.id, id2: outgoingText.id, b1, b2 },
  );
  assert.ok((await getRowTranslateX(page, incomingText.id)) > 20);
  assert.equal(await getRowTranslateX(page, outgoingText.id), 0);
  await page.evaluate(
    ({ id1, id2 }) => {
      const r1 = document.querySelector(`[data-message-id="${id1}"]`);
      const r2 = document.querySelector(`[data-message-id="${id2}"]`);
      r1.dispatchEvent(
        new PointerEvent("pointercancel", {
          bubbles: true,
          pointerId: 10,
          isPrimary: true,
          pointerType: "touch",
        }),
      );
      r2.dispatchEvent(
        new PointerEvent("pointercancel", {
          bubbles: true,
          pointerId: 11,
          isPrimary: true,
          pointerType: "touch",
        }),
      );
    },
    { id1: incomingText.id, id2: outgoingText.id },
  );
  await waitRowRest(page, incomingText.id);

  // M. Reduced motion: travel is clamped small, still triggers reply, snaps cleanly
  await page.emulateMedia({ reducedMotion: "reduce" });
  await bubble(page, incomingText.id).evaluate((el) =>
    el.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  const rmBox = await bubble(page, incomingText.id).locator(".message-bubble").boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: rmBox.x + 20, y: rmBox.y + rmBox.height / 2, id: 1 }],
  });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: rmBox.x + 20 + i * 20, y: rmBox.y + rmBox.height / 2, id: 1 }],
    });
  }
  const rmTravel = await getRowTranslateX(page, incomingText.id);
  assert.ok(
    rmTravel > 0 && rmTravel < 15,
    `Expected subtle reduced-motion travel, got ${rmTravel} (rmBox=${JSON.stringify(rmBox)})`,
  );
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.locator(".reply-bar").getByText(incomingText.content).waitFor();
  assert.equal(await getRowTranslateX(page, incomingText.id), 0);

  await mobileCtx.close();

  // 2. Desktop PC mouse behavior: text selection preserved, bubble padding/row/media swipe-to-reply
  const desktopCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setup(desktopCtx);
  const dPage = await desktopCtx.newPage();
  dPage.setDefaultTimeout(10000);
  dPage.on("pageerror", (e) => errors.push(e.message));
  await dPage.goto(`${baseUrl}/chats/${chatId}`);
  await dPage.locator(".message-list").waitFor();
  await dPage.waitForTimeout(300);

  const mouseSwipe = async (startX, startY, endX, endY, steps = 8) => {
    await dPage.mouse.move(startX, startY);
    await dPage.mouse.down();
    await dPage.mouse.move(endX, endY, { steps });
  };

  // 2a. Dragging directly over message text selects text and does NOT swipe
  await bubble(dPage, incomingText.id).scrollIntoViewIfNeeded();
  const dTextBox = await bubble(dPage, incomingText.id).locator(".message-text").boundingBox();
  await mouseSwipe(
    dTextBox.x + 4,
    dTextBox.y + dTextBox.height / 2,
    dTextBox.x + 140,
    dTextBox.y + dTextBox.height / 2,
  );
  assert.equal(await getRowTranslateX(dPage, incomingText.id), 0);
  await dPage.mouse.up();
  assert.equal(await dPage.locator(".reply-bar").count(), 0);
  const selectedText = await dPage.evaluate(() => window.getSelection()?.toString() ?? "");
  assert.ok(selectedText.length > 0, `Expected mouse drag to select text, got "${selectedText}"`);
  await dPage.evaluate(() => window.getSelection()?.removeAllRanges());

  // 2b. Dragging from bubble padding on incoming text swipes right, arms, and triggers reply
  const dBubbleBox = await bubble(dPage, incomingText.id).locator(".message-bubble").boundingBox();
  await mouseSwipe(
    dBubbleBox.x + 4,
    dBubbleBox.y + dBubbleBox.height / 2,
    dBubbleBox.x + 180,
    dBubbleBox.y + dBubbleBox.height / 2,
  );
  const mouseTravel = await getRowTranslateX(dPage, incomingText.id);
  assert.ok(
    mouseTravel >= 48 && mouseTravel < 84,
    `Expected desktop mouse travel in [48, 84), got ${mouseTravel}`,
  );
  assert.equal(
    await bubble(dPage, incomingText.id)
      .locator(".message-swipe-indicator")
      .getAttribute("data-armed"),
    "true",
  );
  await dPage.mouse.up();
  await dPage.locator(".reply-bar").getByText(incomingText.content).waitFor();
  assert.equal(
    await dPage.evaluate(() => document.activeElement?.matches(".composer-input textarea")),
    true,
  );
  await waitRowRest(dPage, incomingText.id);
  await dPage.getByRole("button", { name: "Cancel reply" }).click();

  // 2c. Dragging in row space on an outgoing message swipes right to reply
  await bubble(dPage, outgoingText.id).scrollIntoViewIfNeeded();
  const dOutRowBox = await bubble(dPage, outgoingText.id).boundingBox();
  await mouseSwipe(
    dOutRowBox.x + 40,
    dOutRowBox.y + dOutRowBox.height / 2,
    dOutRowBox.x + 220,
    dOutRowBox.y + dOutRowBox.height / 2,
  );
  await dPage.mouse.up();
  await dPage.locator(".reply-bar").getByText(outgoingText.content).waitFor();
  await waitRowRest(dPage, outgoingText.id);
  await dPage.getByRole("button", { name: "Cancel reply" }).click();

  // 2d. Mouse drag on ImageMessage swipes without opening lightbox; clean click opens lightbox
  await bubble(dPage, imageMsg.id).evaluate((el) =>
    el.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await bubble(dPage, imageMsg.id).locator("img").waitFor();
  const dImgBox = await bubble(dPage, imageMsg.id).locator(".message-image").boundingBox();
  await mouseSwipe(
    dImgBox.x + 20,
    dImgBox.y + dImgBox.height / 2,
    dImgBox.x + 200,
    dImgBox.y + dImgBox.height / 2,
  );
  await dPage.mouse.up();
  await dPage.locator(".reply-bar").getByText("📷 Photo").waitFor();
  assert.equal(await dPage.locator("dialog.media-lightbox[open]").count(), 0);
  await waitRowRest(dPage, imageMsg.id);
  await dPage.getByRole("button", { name: "Cancel reply" }).click();

  await bubble(dPage, imageMsg.id).getByRole("button", { name: "Open image" }).click();
  await dPage.locator("dialog.media-lightbox[open]").waitFor();
  await dPage.getByRole("button", { name: "Close", exact: true }).click();
  await dPage.locator("dialog.media-lightbox[open]").waitFor({ state: "detached" });

  // 2e. Mouse drag on StickerMessage and LocationMessage swipes to reply without navigating
  for (const [id, label] of [
    [stickerMsg.id, "Sticker"],
    [locationMsg.id, "Location"],
  ]) {
    await bubble(dPage, id).scrollIntoViewIfNeeded();
    const mBox = await bubble(dPage, id).locator(".message-bubble").boundingBox();
    await mouseSwipe(mBox.x + 20, mBox.y + mBox.height / 2, mBox.x + 200, mBox.y + mBox.height / 2);
    await dPage.mouse.up();
    await dPage.locator(".reply-bar").getByText(label).waitFor();
    await waitRowRest(dPage, id);
    await dPage.getByRole("button", { name: "Cancel reply" }).click();
  }

  // 2f. Mouse drag on audio seek slider scrubs audio and does NOT swipe
  await bubble(dPage, audioMsg.id).scrollIntoViewIfNeeded();
  const dSliderBox = await bubble(dPage, audioMsg.id).locator(".voice-track input").boundingBox();
  await mouseSwipe(
    dSliderBox.x + 10,
    dSliderBox.y + dSliderBox.height / 2,
    dSliderBox.x + 120,
    dSliderBox.y + dSliderBox.height / 2,
  );
  await dPage.mouse.up();
  assert.equal(await dPage.locator(".reply-bar").count(), 0);
  assert.equal(await getRowTranslateX(dPage, audioMsg.id), 0);

  // 2g. Accessible overflow menu reply still works on desktop
  await bubble(dPage, incomingText.id).scrollIntoViewIfNeeded();
  await bubble(dPage, incomingText.id).hover();
  await bubble(dPage, incomingText.id)
    .getByRole("button", { name: "Message actions", exact: true })
    .click();
  await dPage.getByRole("menuitem", { name: "Reply", exact: true }).click();
  await dPage.locator(".reply-bar").getByText(incomingText.content).waitFor();

  await desktopCtx.close();

  assert.deepEqual(errors, []);
  console.log("PASS swipe-to-reply browser suite");
} finally {
  await browser.close();
}
