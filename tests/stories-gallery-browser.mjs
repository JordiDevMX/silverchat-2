import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const origin = process.env.UI_REVIEW_URL ?? "http://127.0.0.1:5177";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
});
try {
  const page = await browser.newPage();
  const errors = [],
    remote = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin || url.pathname.startsWith("/api/")) remote.push(request.url());
  });
  await page.goto(`${origin}/tests/ui-foundation.html#stories-gallery`);
  await page.waitForLoadState("networkidle");
  const gallery = page.locator("#stories-gallery");
  await gallery.getByRole("heading", { name: "Stories", exact: true }).waitFor();
  const frame = gallery.locator(".story-preview-frame");
  assert.equal(await gallery.locator("audio,video").count(), 0);
  assert.equal(await gallery.locator(".story-card").count(), 4);
  const progress = await frame.locator(".story-progress").innerHTML();
  await page.waitForTimeout(300);
  assert.equal(await frame.locator(".story-progress").innerHTML(), progress);
  await frame.getByRole("button", { name: "Next preview", exact: true }).click();
  await frame.getByText("See you at sunset.", { exact: true }).waitFor();
  await frame.getByRole("button", { name: "Previous preview", exact: true }).click();
  await frame.getByRole("button", { name: "Pause preview story" }).click();
  await frame.getByText("Paused preview", { exact: true }).waitFor();
  await frame.getByRole("textbox", { name: "Preview story reply" }).fill("Beautiful evening");
  await frame.getByRole("button", { name: "Send preview reply" }).click();
  assert.equal(await frame.getByRole("textbox", { name: "Preview story reply" }).inputValue(), "");
  await gallery.getByRole("status").filter({ hasText: "sent locally" }).waitFor();
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
          `${width}/${mode}/${accent} page containment`,
        );
        const rings = await gallery.locator(".story-avatar-ring").evaluateAll((els) =>
          els.map((el) => ({
            border: getComputedStyle(el).borderTopColor,
            shadow: getComputedStyle(el).boxShadow,
          })),
        );
        assert.notEqual(rings[0].border, rings[1].border);
        assert.notEqual(rings[0].shadow, "none");
        assert.equal(rings[1].shadow, "none");
        const fill = await gallery
          .locator(".story-camera")
          .evaluate((el) => getComputedStyle(el).backgroundImage);
        assert.equal(
          fill,
          await page
            .getByRole("button", { name: "Follow", exact: true })
            .evaluate((el) => getComputedStyle(el).backgroundImage),
        );
        const trigger = gallery.getByRole("button", { name: "Preview unseen Sofia", exact: true });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "Preview story", exact: true });
        await dialog.waitFor();
        assert.ok(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
        const box = await dialog.boundingBox();
        assert.ok(box.width <= width && box.height <= height);
        assert.equal(
          await dialog
            .locator(".story-overlay-body")
            .evaluate((el) => getComputedStyle(el).animationName),
          "story-enter",
        );
        await dialog.getByRole("button", { name: "Preview viewers", exact: true }).click();
        const sheet = page.getByRole("dialog", { name: "Preview viewed by 2" });
        await sheet.waitFor();
        assert.ok((await sheet.boundingBox()).width <= width);
        await sheet.getByRole("button", { name: "Close preview viewers" }).focus();
        await page.keyboard.press("Tab");
        assert.equal(await sheet.locator(":focus").count(), 1);
        await page.keyboard.press("Escape");
        await sheet.waitFor({ state: "detached" });
        assert.equal(
          await dialog
            .getByRole("button", { name: "Preview viewers", exact: true })
            .evaluate((el) => el === document.activeElement),
          true,
        );
        const exit = await dialog.evaluate(async (element) => {
          element.querySelector('[aria-label="Close preview story"]').click();
          await new Promise(requestAnimationFrame);
          const body = element.querySelector(".story-overlay-body");
          return {
            inert: body.inert,
            animation: getComputedStyle(body).animationName,
            duration: getComputedStyle(body).animationDuration,
          };
        });
        assert.deepEqual(exit, { inert: true, animation: "story-exit", duration: "0.2s" });
        await dialog.waitFor({ state: "detached" });
        assert.equal(await trigger.evaluate((el) => el === document.activeElement), true);
      }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gallery.getByRole("button", { name: "Preview add story", exact: true }).click();
    const creator = page.getByRole("dialog", { name: "Preview create story", exact: true });
    await creator.waitFor();
    assert.equal(
      await creator
        .locator(".story-overlay-body")
        .evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    assert.ok((await creator.boundingBox()).width <= width);
    await creator.getByRole("textbox", { name: "Preview story text" }).fill("A new day");
    await creator.getByRole("button", { name: "Save preview story" }).click();
    assert.equal(await creator.count(), 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  console.log(
    "PASS: offline story cards/rings, static progress, stepped navigation/reply, viewer/sheet/creator, keyboard/focus, enter/exit and instant reduced motion; 36 viewport/theme/accent combinations; no network or screenshots.",
  );
} finally {
  await browser.close();
}
