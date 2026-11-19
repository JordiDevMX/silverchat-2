// Real browser tests for project-wide clipboard image insertion.
import assert from "node:assert/strict";
import { launchBrowser } from "./lib/browser.mjs";

const browser = await launchBrowser({ args: ["--no-sandbox"] });
const uid = (n) => `${String(n).padStart(8, "0")}-5555-4555-8555-555555555555`;
const me = uid(1);
const other = uid(2);
const groupId = uid(101);
const channelId = uid(201);

const ownedChannel = {
  id: channelId,
  owner_id: me,
  name: "Release notes",
  slug: "release-notes",
  description: "Channel updates",
  follower_count: 1,
  is_verified: false,
  avatar_url: null,
  created_at: new Date(Date.now() - 3600000).toISOString(),
  updated_at: new Date().toISOString(),
  last_message_at: null,
  last_message_preview: null,
};

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
    bio: "Original bio",
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
const groupChat = {
  id: groupId,
  type: "group",
  name: "Design squad",
  direct_pair_key: null,
  status: "active",
  avatar_url: null,
  community_id: null,
};
const members = [
  {
    chat_id: groupId,
    user_id: me,
    role: "admin",
    joined_at: "2020-01-01T00:00:00Z",
    manually_unread: false,
  },
  {
    chat_id: groupId,
    user_id: other,
    role: "member",
    joined_at: "2020-01-01T00:00:00Z",
    manually_unread: false,
  },
];
const rows = [
  {
    id: uid(1000),
    chat_id: groupId,
    sender_id: other,
    type: "text",
    content: "Drop the screenshots here",
    created_at: ago(10),
    deleted_for_everyone: false,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    mentions: null,
  },
  {
    id: uid(1001),
    chat_id: groupId,
    sender_id: me,
    type: "text",
    content: "Editable message",
    created_at: ago(2),
    deleted_for_everyone: false,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    mentions: null,
  },
];

let uploads = [];
const uploadBytes = [];
let failNextStorageUpload = false;
let storageUploadDelayMs = 0;
let mfaPending = false;
const pageErrors = [];

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function setup(context) {
  await context.route("https://cdn.jsdelivr.net/npm/emojibase-data@*/**", (r) => r.abort());
  await context.route("**/api/auth/**", (r) =>
    json(r, {
      accessToken: jwt,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      user,
      aal: mfaPending ? "aal1" : "aal2",
      mfaRequired: mfaPending,
    }),
  );
  await context.route("https://supabase.test/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const s = url.searchParams;
    const method = req.method();
    const object = req.headers().accept?.includes("object");
    const result = (data) => json(route, object ? (data[0] ?? null) : data);

    if (p.endsWith("/user")) return json(route, user);
    if (p.endsWith("/profiles")) return json(route, profiles[0]);
    if (p.endsWith("/user_settings")) {
      return json(route, {
        user_id: me,
        theme: "light",
        accent: "blue",
        language: "en",
        read_receipts_enabled: true,
      });
    }
    if (p.endsWith("/profiles_visible")) {
      return result(profiles.filter((x) => !s.get("id") || s.get("id").includes(x.id)));
    }
    if (p.endsWith("/user_blocks") || p.endsWith("/profiles_blocked")) return result([]);
    if (p.endsWith("/chats")) return result([groupChat]);
    if (p.endsWith("/chat_members")) {
      if (s.get("select")?.includes("chat:chats")) {
        return result([
          {
            ...members[0],
            chat: {
              ...groupChat,
              last_message_id: rows.at(-1)?.id,
              last_message: rows.at(-1),
              last_message_at: ago(2),
              last_message_preview: rows.at(-1)?.content,
            },
          },
        ]);
      }
      return result(members);
    }
    if (p.endsWith("/chat_requests")) return result([]);
    if (p.endsWith("/pinned_messages")) return result([]);
    if (p.endsWith("/message_receipts")) return result([]);
    if (p.endsWith("/message_reactions")) return result([]);
    if (p.endsWith("/stories")) return result([]);
    if (p.endsWith("/channels")) return result([ownedChannel]);
    if (p.endsWith("/channel_follows")) return result([]);
    if (p.endsWith("/rpc/get_channel_messages")) return json(route, []);
    if (p.endsWith("/rpc/get_chat_messages")) return json(route, rows);
    if (p.endsWith("/rpc/mark_chat_as_read")) return json(route, null);
    if (p.endsWith("/rpc/own_upload_is_referenced")) return json(route, false);
    if (p.endsWith("/messages")) {
      if (method === "POST") {
        const body = JSON.parse(req.postData());
        const row = {
          created_at: new Date().toISOString(),
          deleted_at: null,
          deleted_for_everyone: false,
          edited_at: null,
          is_pinned_in_chat: false,
          reply_to_message_id: null,
          reply_to_story_id: null,
          file_upload_id: null,
          media_thumbnail_upload_id: null,
          mentions: null,
          media_peaks: null,
          forwarded_from_message_id: null,
          location_data: null,
          contact_data: null,
          ...body,
        };
        rows.push(row);
        return json(route, { id: row.id });
      }
      if (s.get("channel_id")?.includes(channelId)) return result([]);
      return result(rows);
    }
    if (p.endsWith("/file_uploads")) {
      if (method === "POST") {
        const body = JSON.parse(req.postData());
        const record = { status: "pending", created_at: new Date().toISOString(), ...body };
        uploads.push(record);
        return json(route, record);
      }
      if (method === "PATCH") {
        const id = s.get("id")?.slice(3);
        const patch = JSON.parse(req.postData());
        const item = uploads.find((u) => u.id === id);
        if (item) Object.assign(item, patch);
        return json(route, item ?? {});
      }
      if (method === "DELETE") {
        const id = s.get("id")?.slice(3);
        uploads = uploads.filter((u) => u.id !== id);
        return json(route, []);
      }
      return result(uploads.filter((u) => !s.get("id") || s.get("id").includes(u.id)));
    }
    if (p.includes("/storage/v1/object/sign/")) {
      return json(route, { signedURL: "/object/sign/signed-test" });
    }
    if (p.includes("/storage/v1/object/")) {
      if (method === "POST") {
        if (storageUploadDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, storageUploadDelayMs));
        }
        if (failNextStorageUpload) {
          failNextStorageUpload = false;
          return json(route, { error: "Simulated outage" }, 503);
        }
        const buf = req.postDataBuffer() ?? Buffer.alloc(0);
        uploadBytes.push({
          path: p,
          type: req.headers()["content-type"],
          size: buf.length,
        });
        return json(route, { Key: p });
      }
      if (method === "DELETE") return json(route, []);
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          "base64",
        ),
      });
    }
    return json(route, []);
  });
}

async function createSamplePngBase64(color = "#2f87ff", page) {
  return page.evaluate((fill) => {
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 120;
    const g = c.getContext("2d");
    g.fillStyle = fill;
    g.fillRect(0, 0, 160, 120);
    return c.toDataURL("image/png").split(",")[1];
  }, color);
}

/**
 * Dispatch a real ClipboardEvent("paste") with files and optional plainText onto the
 * currently focused element (or specified selector). When text is also provided and
 * not prevented, simulate the browser's text insertion just like native Ctrl+V.
 */
async function dispatchPaste(page, selector, { files = [], text = "" }) {
  return page.evaluate(
    ({ sel, pasteFiles, pasteText }) => {
      const target = sel ? document.querySelector(sel) : document.activeElement;
      if (!target) throw new Error(`Target not found: ${sel}`);
      if (target instanceof HTMLElement) target.focus();

      const dt = new DataTransfer();
      if (pasteText) {
        dt.setData("text/plain", pasteText);
      }
      for (const spec of pasteFiles) {
        let bytes;
        if (spec.base64) {
          const raw = atob(spec.base64);
          bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
        } else {
          bytes = new Uint8Array(spec.size ?? 16);
        }
        const file = new File([bytes], spec.name, { type: spec.type });
        dt.items.add(file);
      }

      const event = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });
      const notPrevented = target.dispatchEvent(event);

      // Synthetic ClipboardEvent doesn't mutate input value automatically in Chromium;
      // mirror native browser text insertion whenever paste wasn't prevented.
      if (
        notPrevented &&
        pasteText &&
        (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
      ) {
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        const nextVal = target.value.slice(0, start) + pasteText + target.value.slice(end);
        const proto =
          target instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
        descriptor?.set?.call(target, nextVal);
        target.setSelectionRange(start + pasteText.length, start + pasteText.length);
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return { notPrevented };
    },
    { sel: selector, pasteFiles: files, pasteText: text },
  );
}

async function writePngToRealClipboard(page, color = "#2f87ff") {
  await page.evaluate(async (fill) => {
    const c = document.createElement("canvas");
    c.width = 120;
    c.height = 90;
    const g = c.getContext("2d");
    g.fillStyle = fill;
    g.fillRect(0, 0, 120, 90);
    const blob = await new Promise((res) => c.toBlob(res, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  }, color);
}

const baseUrl = process.env.UI_BASE_URL ?? "http://127.0.0.1:5173";

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await setup(context);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto(`${baseUrl}/chats/${groupId}`);
  const composerInput = page.getByRole("textbox", { name: "Message", exact: true });
  await composerInput.waitFor();

  // 0. Hostile real-clipboard paste under uncached load + 6x CPU throttling:
  // a single OS-like PNG must insert exactly 1 item on first paste and 2 after a second paste.
  await writePngToRealClipboard(page, "#2563eb");
  await composerInput.focus();
  await page.keyboard.press("Control+v");
  await page.locator('[data-slot="composer-attachment-tray"]').waitFor();
  assert.equal(await page.locator('[data-slot="composer-attachment-item"]').count(), 1);
  await page.keyboard.press("Control+v");
  await page.waitForTimeout(150);
  assert.equal(await page.locator('[data-slot="composer-attachment-item"]').count(), 2);
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  assert.equal(await page.locator('[data-slot="composer-attachment-tray"]').count(), 0);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  const pngBlue = await createSamplePngBase64("#2f87ff", page);
  const pngGreen = await createSamplePngBase64("#10b981", page);

  // 1. Plain-text paste keeps working identically without opening attachment tray.
  await dispatchPaste(page, ".composer-input textarea", { text: "Plain hello" });
  assert.equal(await composerInput.inputValue(), "Plain hello");
  assert.equal(await page.locator('[data-slot="composer-attachment-tray"]').count(), 0);
  await composerInput.fill("");

  // 2. Single image paste + reply + mention + send through prepareAndUpload.
  await page
    .locator(`[data-message-id="${rows[0].id}"]`)
    .getByRole("button", { name: "Message actions" })
    .click();
  await page.getByRole("menuitem", { name: "Reply" }).click();
  await page.locator(".reply-bar").waitFor();

  await dispatchPaste(page, ".composer-input textarea", {
    files: [{ name: "shot-1.png", type: "image/png", base64: pngBlue }],
  });
  await page.locator('[data-slot="composer-attachment-tray"]').waitFor();
  assert.equal(await page.locator('[data-slot="composer-attachment-item"]').count(), 1);

  await composerInput.type("Check @sof");
  await page.getByRole("option").waitFor();
  await composerInput.press("Enter");
  assert.equal(await composerInput.inputValue(), "Check @sofia ");

  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.locator('[data-slot="composer-attachment-tray"]').waitFor({ state: "hidden" });
  await page.waitForTimeout(300);

  const firstSent = rows.at(-1);
  assert.equal(firstSent.type, "image");
  assert.equal(firstSent.content, "Check @sofia");
  assert.deepEqual(firstSent.mentions, [other]);
  assert.equal(firstSent.reply_to_message_id, rows[0].id);
  assert.equal(uploadBytes.at(-1).type, "image/webp");
  assert.ok(uploadBytes.at(-1).size < 200000);

  // 3. Multiple images + repeated paste + mixed text+image + remove individual image.
  await dispatchPaste(page, ".composer-input textarea", {
    files: [
      { name: "multi-1.png", type: "image/png", base64: pngBlue },
      { name: "multi-2.png", type: "image/png", base64: pngGreen },
    ],
  });
  await dispatchPaste(page, ".composer-input textarea", {
    files: [{ name: "repeat-3.png", type: "image/png", base64: pngBlue }],
    text: "Batch caption",
  });
  assert.equal(await page.locator('[data-slot="composer-attachment-item"]').count(), 3);
  assert.equal(await composerInput.inputValue(), "Batch caption");

  // Remove the 2nd image and verify focus management moves to remaining remove button.
  await page.getByRole("button", { name: /Remove multi-2\.png/ }).click();
  assert.equal(await page.locator('[data-slot="composer-attachment-item"]').count(), 2);
  const focusedLabel = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  assert.match(focusedLabel ?? "", /Remove repeat-3\.png/);

  // Inspect modal on click and close cleanly.
  await page.getByRole("button", { name: /Preview multi-1\.png/ }).click();
  await page.getByRole("dialog", { name: "multi-1.png" }).waitFor();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("dialog", { name: "multi-1.png" }).waitFor({ state: "hidden" });

  // 4. Edge cases: unsupported SVG + oversized >25MB rejected cleanly; existing 2 kept.
  await dispatchPaste(page, ".composer-input textarea", {
    files: [{ name: "icon.svg", type: "image/svg+xml", size: 64 }],
  });
  await page.locator(".composer-error").waitFor();
  assert.match(await page.locator(".composer-error").textContent(), /Unsupported image format/);
  assert.equal(await page.locator('[data-slot="composer-attachment-item"]').count(), 2);

  await dispatchPaste(page, ".composer-input textarea", {
    files: [{ name: "huge.png", type: "image/png", size: 26 * 1024 * 1024 }],
  });
  assert.match(await page.locator(".composer-error").textContent(), /25 MB/);

  // 5. Upload failure & retry keeps text and images; retry succeeds.
  failNextStorageUpload = true;
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.locator('[data-slot="composer-attachment-item"][data-status="failed"]').waitFor();
  assert.equal(await composerInput.inputValue(), "Batch caption");

  // Retry the failed image; then send remaining queued item.
  await page.getByRole("button", { name: /Retry multi-1\.png/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.locator('[data-slot="composer-attachment-tray"]').waitFor({ state: "hidden" });
  assert.equal(await composerInput.inputValue(), "");

  // 6. Pasting mid-upload queues the new image without corrupting or aborting active upload.
  await dispatchPaste(page, ".composer-input textarea", {
    files: [{ name: "inflight-1.png", type: "image/png", base64: pngBlue }],
  });
  storageUploadDelayMs = 450;
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.waitForTimeout(100);
  await dispatchPaste(page, ".composer-input textarea", {
    files: [{ name: "queued-mid-upload.png", type: "image/png", base64: pngGreen }],
  });
  storageUploadDelayMs = 0;
  await page.waitForTimeout(600);
  assert.equal(await page.locator('[data-slot="composer-attachment-item"]').count(), 1);
  assert.match(
    (await page.getByRole("button", { name: /Preview queued-mid-upload\.png/ }).getAttribute("aria-label")) ?? "",
    /queued-mid-upload\.png/,
  );
  await page.getByRole("button", { name: /Remove queued-mid-upload\.png/ }).click();
  assert.equal(await page.locator('[data-slot="composer-attachment-tray"]').count(), 0);

  // 7. >10 image cap enforcement.
  const twelve = Array.from({ length: 12 }, (_, idx) => ({
    name: `batch-${idx + 1}.png`,
    type: "image/png",
    base64: pngBlue,
  }));
  await dispatchPaste(page, ".composer-input textarea", { files: twelve });
  assert.equal(await page.locator('[data-slot="composer-attachment-item"]').count(), 10);
  assert.match(await page.locator(".composer-error").textContent(), /Up to 10 images/);
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  assert.equal(await page.locator('[data-slot="composer-attachment-tray"]').count(), 0);

  // 8. MediaPreviewModal accepts pasted images into multi-image strip (real clipboard, 1 -> 2).
  await page.getByRole("button", { name: "Attach", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "picker.png",
    mimeType: "image/png",
    buffer: Buffer.from(pngBlue, "base64"),
  });
  const previewModal = page.getByRole("dialog", { name: "Send attachment" });
  await previewModal.waitFor();
  await writePngToRealClipboard(page, "#10b981");
  await previewModal.locator("textarea").focus();
  await page.keyboard.press("Control+v");
  await previewModal.locator(".media-preview-strip").waitFor();
  assert.equal(await previewModal.locator(".media-preview-strip-item").count(), 2);
  await previewModal.getByRole("button", { name: "Cancel", exact: true }).click();
  await previewModal.waitFor({ state: "hidden" });

  // 9. Text-only graceful degradation: InChatSearch (mixed text + image) and EditMessageModal (inside <dialog>).
  await page.getByRole("button", { name: "Search messages", exact: true }).click();
  const inChatSearch = page.getByRole("searchbox", { name: "Search in conversation" });
  await dispatchPaste(page, ".in-chat-search-input", {
    files: [{ name: "search-shot.png", type: "image/png", base64: pngBlue }],
    text: "Editable",
  });
  assert.equal(await inChatSearch.inputValue(), "Editable");
  await page.locator('[data-slot="clipboard-paste-notice"]').waitFor();
  assert.match(
    await page.locator('[data-slot="clipboard-paste-notice"]').textContent(),
    /search fields don't support images/i,
  );
  await page.getByRole("button", { name: "Close search", exact: true }).click();

  await page
    .locator(`[data-message-id="${rows[1].id}"]`)
    .getByRole("button", { name: "Message actions" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit message" });
  await editDialog.waitFor();
  await dispatchPaste(page, 'dialog[open] textarea', {
    files: [{ name: "edit-shot.png", type: "image/png", base64: pngBlue }],
  });
  assert.equal(await editDialog.locator("textarea").inputValue(), "Editable message");
  await editDialog.locator('[data-slot="clipboard-paste-notice"].in-dialog').waitFor();
  assert.match(
    await editDialog.locator('[data-slot="clipboard-paste-notice"]').textContent(),
    /Message editing only supports text/i,
  );
  await editDialog.getByRole("button", { name: "Cancel", exact: true }).click();

  // 10. Non-chat image-capable inputs: StoryCreator and ChannelComposer.
  await page.goto(`${baseUrl}/channels/${channelId}`);
  const channelInput = page.getByRole("textbox", { name: "Message", exact: true });
  await channelInput.waitFor();
  await writePngToRealClipboard(page, "#0ea5e9");
  await channelInput.focus();
  await page.keyboard.press("Control+v");
  await page.locator('[data-slot="composer-attachment-tray"]').waitFor();
  assert.equal(await page.locator('[data-slot="composer-attachment-item"]').count(), 1);

  await page.goto(`${baseUrl}/novedades`);
  await page.getByRole("button", { name: /Add story|Create story|My story/i }).first().click();
  const storyDialog = page.getByRole("dialog", { name: "Create story" });
  await storyDialog.waitFor();
  await writePngToRealClipboard(page, "#10b981");
  await storyDialog.locator("textarea").fill("Story caption");
  await storyDialog.locator("textarea").focus();
  await page.keyboard.press("Control+v");
  await storyDialog.locator(".story-create-preview img").waitFor();
  assert.equal(await storyDialog.locator("textarea").inputValue(), "Story caption");
  assert.equal(await storyDialog.locator('[role="alert"]').count(), 0);
  await storyDialog.getByRole("button", { name: "Cancel", exact: true }).click();

  // 11. AvatarPickerModal accepts real-clipboard image + /settings/profile bio rejects gracefully.
  await page.goto(`${baseUrl}/settings/profile`);
  const bio = page.locator("#bio");
  await bio.waitFor();
  await dispatchPaste(page, "#bio", {
    files: [{ name: "avatar.png", type: "image/png", base64: pngBlue }],
  });
  assert.equal(await bio.inputValue(), "Original bio");
  await page.locator('[data-slot="clipboard-paste-notice"]').waitFor();
  assert.match(
    await page.locator('[data-slot="clipboard-paste-notice"]').textContent(),
    /Change photo/i,
  );
  await page.getByRole("button", { name: "Change photo", exact: true }).click();
  const avatarDialog = page.getByRole("dialog", { name: "Change photo" });
  await avatarDialog.waitFor();
  await writePngToRealClipboard(page, "#f59e0b");
  await page.keyboard.press("Control+v");
  await avatarDialog.locator(".avatar-crop").waitFor();
  assert.equal(await avatarDialog.locator('[data-slot="clipboard-paste-notice"]').count(), 0);
  await avatarDialog.getByRole("button", { name: "Cancel", exact: true }).click();

  // 11b. Unregistered contenteditable element degrades gracefully without corrupting content.
  await page.evaluate(() => {
    const ce = document.createElement("div");
    ce.id = "test-ce";
    ce.contentEditable = "true";
    ce.textContent = "Keep me";
    document.body.appendChild(ce);
    ce.focus();
  });
  await writePngToRealClipboard(page, "#ef4444");
  await page.keyboard.press("Control+v");
  await page.locator('[data-slot="clipboard-paste-notice"]').waitFor();
  assert.equal(await page.evaluate(() => document.getElementById("test-ce")?.textContent), "Keep me");
  await page.evaluate(() => document.getElementById("test-ce")?.remove());

  // 12. Auth 2FA CodeInput preserves digits on image paste AND supports 6-digit paste.
  mfaPending = true;
  await page.goto(`${baseUrl}/auth/2fa-verify`);
  const firstDigit = page.getByRole("textbox", { name: "Digit 1" });
  await firstDigit.waitFor();
  await firstDigit.fill("1");
  await page.getByRole("textbox", { name: "Digit 2" }).fill("2");
  await dispatchPaste(page, '[aria-label="Digit 3"]', {
    files: [{ name: "qr.png", type: "image/png", base64: pngBlue }],
  });
  assert.equal(await firstDigit.inputValue(), "1");
  assert.equal(await page.getByRole("textbox", { name: "Digit 2" }).inputValue(), "2");
  await page.locator('[data-slot="clipboard-paste-notice"]').waitFor();
  await dispatchPaste(page, '[aria-label="Digit 1"]', { text: "654321" });
  assert.equal(await firstDigit.inputValue(), "6");
  assert.equal(await page.getByRole("textbox", { name: "Digit 6" }).inputValue(), "1");
  mfaPending = false;

  // 13. Mobile viewport layout & overflow check with pasted images.
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await setup(mobile);
  const mp = await mobile.newPage();
  mp.on("pageerror", (e) => pageErrors.push(e.message));
  await mp.goto(`${baseUrl}/chats/${groupId}`);
  await mp.getByRole("textbox", { name: "Message", exact: true }).waitFor();
  await dispatchPaste(mp, ".composer-input textarea", {
    files: [
      { name: "mob-1.png", type: "image/png", base64: pngBlue },
      { name: "mob-2.png", type: "image/png", base64: pngGreen },
    ],
  });
  await mp.locator('[data-slot="composer-attachment-tray"]').waitFor();
  assert.equal(
    await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
    "No horizontal mobile overflow with attachment tray",
  );
  const composerBox = await mp.locator(".conversation-composer").boundingBox();
  assert.ok(
    composerBox.y + composerBox.height <= 844 - 68 + 1,
    "Composer with attachment tray stays above mobile navigation",
  );
  await mobile.close();
  await context.close();

  assert.deepEqual(pageErrors, []);
  console.log(
    "PASS: clipboard paste (plain text, single/multi/repeated/mixed, remove+focus, inspect, SVG/size/limit caps, retry on failure, mid-upload queue, MediaPreviewModal, StoryCreator, InChatSearch, EditMessageModal dialog portal, Profile Bio, 2FA CodeInput, mobile viewport).",
  );
} finally {
  await browser.close();
}
