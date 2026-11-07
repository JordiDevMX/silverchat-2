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
    if (new URL(request.url()).origin !== origin) remote.push(request.url());
  });
  await page.goto(`${origin}/tests/ui-foundation.html#interactive-gallery`);
  const gallery = page.locator("#interactive-gallery");
  await gallery.getByRole("heading", { name: "Interactive messaging", exact: true }).waitFor();
  assert.equal(await gallery.locator("audio,video").count(), 0);
  await gallery.getByLabel("Preview message", { exact: true }).fill("Draft");
  await gallery.getByRole("button", { name: "Preview insert emoji" }).click();
  assert.equal(
    await gallery.getByLabel("Preview message", { exact: true }).inputValue(),
    "Draft 😀",
  );
  await gallery.getByRole("button", { name: "Preview cancel reply" }).click();
  assert.equal(await gallery.locator(".reply-bar").count(), 0);
  await gallery.getByRole("button", { name: "Reply", exact: true }).click();
  assert.equal(await gallery.locator(".reply-bar").count(), 1);
  await gallery.getByRole("button", { name: "Preview play audio" }).click();
  await gallery.getByRole("button", { name: "Preview pause audio" }).waitFor();
  await gallery.getByRole("slider", { name: "Preview audio position" }).fill("12");
  assert.equal(await gallery.locator(".voice-track .played").count(), 27);
  await gallery.getByRole("button", { name: "Preview start recording" }).click();
  assert.equal(await gallery.locator(".live-wave rect").count(), 40);
  await gallery.getByRole("button", { name: "👍", exact: true }).click();
  assert.equal(
    await gallery.getByRole("button", { name: "👍", exact: true }).getAttribute("aria-pressed"),
    "true",
  );
  await gallery.getByRole("button", { name: "Preview next result" }).click();
  assert.equal(await gallery.locator('.in-chat-search [role="status"]').textContent(), "2/2");
  for (const [width, height] of [
    [375, 844],
    [768, 1024],
    [1280, 900],
  ]) {
    await page.setViewportSize({ width, height });
    for (const mode of ["light", "dark"])
      for (const accent of ["blue", "orange", "green", "purple", "red", "yellow"]) {
        await page
          .getByRole("button", { name: mode === "light" ? "Light" : "Dark", exact: true })
          .click();
        await page.getByRole("combobox", { name: "Accent" }).selectOption(accent);
        await page.evaluate(() =>
          Promise.all(
            document
              .getAnimations()
              .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime))
              .map((a) => a.finished.catch(() => {})),
          ),
        );
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${width}/${mode}/${accent}: overflow`,
        );
        assert.ok(
          await gallery
            .locator(".interactive-preview")
            .evaluateAll((elements) =>
              elements.every((el) => el.scrollWidth <= el.clientWidth + 1),
            ),
          `${width}/${mode}/${accent}: preview clipped`,
        );
        const approved = await page
          .getByRole("button", { name: "Follow", exact: true })
          .evaluate((el) => {
            const style = getComputedStyle(el);
            return { image: style.backgroundImage, color: style.color };
          });
        const send = await gallery.locator(".composer-send").evaluate((el) => {
          const style = getComputedStyle(el);
          return { image: style.backgroundImage, color: style.color };
        });
        assert.deepEqual(
          send,
          approved,
          "Composer uses the approved mode-invariant primary fill and glyph rule",
        );
        assert.equal(
          await gallery
            .locator(".recording-dot")
            .evaluate((el) => getComputedStyle(el).animationName),
          "none",
        );
        assert.ok(
          await gallery
            .locator(".preview-lightbox img")
            .evaluate((el) => el.complete && el.naturalWidth > 0),
        );
      }
    await gallery.getByRole("button", { name: "Edit", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Preview edit message", exact: true });
    await dialog.waitFor();
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.width <= width);
    await dialog.getByLabel("Preview edited message").fill("Updated preview");
    await dialog.getByRole("button", { name: "Save preview edit" }).click();
    assert.equal(
      await gallery.getByLabel("Preview message", { exact: true }).inputValue(),
      "Updated preview",
    );
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  console.log(
    "PASS: offline interactive gallery; composer/reply/emoji, static seek/recording, reactions, edit modal, search and lightbox frame; 36 viewport/theme/accent combinations; no media playback, screenshots or remote requests.",
  );
} finally {
  await browser.close();
}
