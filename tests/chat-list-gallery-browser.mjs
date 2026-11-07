import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const origin = process.env.UI_REVIEW_URL ?? "http://127.0.0.1:5177";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
});
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const errors = [],
    remote = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin || url.pathname.startsWith("/api/")) remote.push(request.url());
  });
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto(`${origin}/`);
  const gallery = page.locator("#chat-list-gallery");
  await gallery.getByRole("heading", { name: "Chat list & creation", exact: true }).waitFor();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  assert.equal(
    await page.evaluate(() => scrollY),
    0,
    "offscreen filters must not scroll the review entry",
  );
  const filter = (name) =>
    gallery.locator(".chat-filters").getByRole("button", { name, exact: true });
  const row = (id) => gallery.locator(`[data-chat-id="preview-${id}"]`);
  assert.equal(await row("unread").locator(".chat-badge").textContent(), "99+");
  assert.equal(await row("muted").locator(".chat-badge").count(), 0);
  assert.equal(await row("muted").getByLabel("Pin", { exact: true }).count(), 1);
  assert.match(await row("draft").textContent(), /Draft.*A thought/);
  assert.equal(await row("manual").getByLabel("Unread", { exact: true }).count(), 1);
  for (const [name, count] of [
    ["Archived", 1],
    ["Unread", 3],
    ["Favorites", 1],
    ["Groups", 1],
    ["Muted", 1],
    ["Blocked", 0],
    ["All", 5],
  ]) {
    await filter(name).click();
    assert.equal(await filter(name).getAttribute("aria-pressed"), "true");
    assert.equal(await gallery.locator(".chat-list-item").count(), count);
  }
  await gallery.getByRole("button", { name: "Preview selection", exact: true }).click();
  await row("unread").locator(".chat-row-main").press("Space");
  assert.equal(await row("unread").locator(".chat-row-main").getAttribute("aria-pressed"), "true");
  await gallery.getByRole("button", { name: "Select all", exact: true }).click();
  await gallery.getByRole("toolbar").getByRole("button", { name: "Mute", exact: true }).click();
  assert.equal(await gallery.locator(".chat-list-gallery-feedback").textContent(), "Bulk mute: 5");
  await gallery.getByRole("button", { name: "Exit selection", exact: true }).click();
  await gallery.getByRole("checkbox", { name: /Mateo/ }).check();
  assert.equal(await gallery.getByRole("checkbox", { name: /Mateo/ }).isChecked(), true);
  for (const [width, height] of [
    [375, 844],
    [768, 1024],
    [1280, 900],
  ]) {
    await page.setViewportSize({ width, height });
    for (const mode of ["light", "dark"])
      for (const accent of ["blue", "purple", "red", "orange", "yellow", "green"]) {
        await page
          .getByRole("button", { name: mode === "light" ? "Light" : "Dark", exact: true })
          .click();
        await page.getByRole("combobox", { name: "Accent" }).selectOption(accent);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${width}/${mode}/${accent} document`,
        );
        const frames = await page
          .locator(".review-shell, section[id$='-gallery']")
          .evaluateAll((nodes) =>
            nodes.map((el) => {
              const rect = el.getBoundingClientRect();
              return {
                id: el.id || "foundation",
                fits: rect.height > 0 && rect.left >= -1 && rect.right <= innerWidth + 1,
              };
            }),
          );
        assert.equal(frames.length, 11);
        assert.ok(
          frames.every((frame) => frame.fits),
          `${width}/${mode}/${accent}: ${JSON.stringify(frames)}`,
        );
        assert.ok(
          await gallery
            .locator(".chat-row-main,.chats-surface,.new-chat-user-row,.new-group-candidate-row")
            .evaluateAll((nodes) => nodes.every((el) => el.scrollWidth <= el.clientWidth + 1)),
          `${width}/${mode}/${accent} containment`,
        );
        const fill = (el) => ({
          background: getComputedStyle(el).backgroundImage,
          color: getComputedStyle(el).color,
        });
        assert.deepEqual(
          await row("unread").locator(".chat-badge").evaluate(fill),
          await page.getByRole("button", { name: "Follow", exact: true }).evaluate(fill),
        );
        await gallery.getByRole("button", { name: "Preview new chat", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "New chat", exact: true });
        await dialog.waitFor();
        assert.ok(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        assert.equal(
          await gallery
            .getByRole("button", { name: "Preview new chat", exact: true })
            .evaluate((el) => el === document.activeElement),
          true,
        );
      }
  }
  await gallery.getByRole("button", { name: "Preview deletion", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText(/oldest remaining member/)
    .waitFor();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const duration = await row("unread")
    .locator(".chat-row-main")
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  assert.ok(duration.includes("0.15s"));
  await gallery.getByRole("button", { name: "Preview new chat", exact: true }).click();
  assert.ok(
    (await page
      .getByRole("dialog")
      .locator(".motion-overlay-body")
      .evaluate((el) => getComputedStyle(el).animationDuration)) !== "0s",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.ok(
    await row("unread")
      .locator(".chat-row-main")
      .evaluate((el) =>
        getComputedStyle(el)
          .transitionDuration.split(",")
          .every((value) => parseFloat(value) <= 0.00001),
      ),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  console.log(
    "PASS chat-list gallery: 36 combinations; unread/muted/draft/pinned/archive states, filters, keyboard selection, pickers, dialog focus/containment, motion and reduced motion; zero remote requests or screenshots.",
  );
} finally {
  await browser.close();
}
