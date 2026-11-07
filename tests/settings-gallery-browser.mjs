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
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.origin !== origin || u.pathname.startsWith("/api/")) remote.push(r.url());
  });
  await page.goto(`${origin}/tests/ui-foundation.html#settings-gallery`);
  await page.waitForLoadState("networkidle");
  const gallery = page.locator("#settings-gallery");
  await gallery
    .getByRole("heading", { name: "Settings shell & preferences", exact: true })
    .waitFor();
  await gallery.getByRole("switch", { name: "Preview notifications", exact: true }).click();
  assert.ok(await gallery.getByRole("switch", { name: "Preview sound", exact: true }).isDisabled());
  await gallery.getByRole("switch", { name: "Preview notifications", exact: true }).click();
  for (const [width, height] of [
    [375, 844],
    [768, 1024],
    [1280, 900],
  ]) {
    await page.setViewportSize({ width, height });
    assert.equal(await gallery.locator(".settings-sidebar").isVisible(), width > 800);
    for (const mode of ["light", "dark"])
      for (const accent of ["blue", "orange", "green", "purple", "red", "yellow"]) {
        await gallery.getByRole("button", { name: `Preview ${mode}`, exact: true }).click();
        await gallery
          .getByRole("button", { name: `Preview ${accent} accent`, exact: true })
          .click();
        assert.equal(await page.locator("html").getAttribute("data-theme"), mode);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${width}/${mode}/${accent} containment`,
        );
        assert.equal(
          await gallery
            .getByRole("button", { name: `Preview ${accent} accent`, exact: true })
            .getAttribute("aria-pressed"),
          "true",
        );
        const gradient = await page
          .getByRole("button", { name: "Follow", exact: true })
          .evaluate((el) => getComputedStyle(el).backgroundImage);
        assert.equal(
          await gallery
            .getByRole("button", { name: `Preview ${accent} accent`, exact: true })
            .evaluate((el) => getComputedStyle(el).backgroundImage),
          gradient,
        );
        assert.equal(
          await gallery
            .getByRole("switch", { name: "Preview notifications", exact: true })
            .evaluate((el) => getComputedStyle(el).backgroundImage),
          gradient,
        );
        const trigger = gallery.getByRole("button", {
          name: "Preview read receipt confirmation",
          exact: true,
        });
        await trigger.click();
        const dialog = page.getByRole("dialog", {
          name: "Preview read receipt confirmation",
          exact: true,
        });
        await dialog.waitFor();
        assert.equal(
          await dialog
            .locator(".motion-overlay-body")
            .evaluate((el) => getComputedStyle(el).animationName),
          "settings-enter",
        );
        assert.ok(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
        const box = await dialog.boundingBox();
        assert.ok(box.width <= width && box.height <= height);
        await dialog.getByRole("button", { name: "Confirm settings preview", exact: true }).focus();
        await page.keyboard.press("Tab");
        assert.equal(await dialog.locator(":focus").count(), 1);
        await dialog.getByRole("switch", { name: "Preview pending save", exact: true }).click();
        await page.keyboard.press("Escape");
        assert.ok(await dialog.isVisible());
        await page.keyboard.press("Escape");
        assert.equal(await dialog.evaluate((el) => el.open), true);
        assert.ok(
          await dialog
            .getByRole("button", { name: "Cancel settings preview", exact: true })
            .isDisabled(),
        );
        await dialog.getByRole("switch", { name: "Preview pending save", exact: true }).click();
        await page.keyboard.press("Escape");
        await page.locator("dialog.settings-dialog").waitFor({ state: "detached" });
        assert.ok(await trigger.evaluate((el) => el === document.activeElement));
      }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await gallery.locator(".settings-panel").evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  const trigger = gallery.getByRole("button", {
    name: "Preview read receipt confirmation",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Preview read receipt confirmation",
    exact: true,
  });
  assert.equal(
    await dialog
      .locator(".motion-overlay-body")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await dialog.getByRole("button", { name: "Cancel settings preview", exact: true }).click();
  assert.equal(await page.locator(".settings-dialog").count(), 0);
  await trigger.click();
  await page.getByRole("button", { name: "Confirm settings preview", exact: true }).click();
  await gallery.getByRole("status").filter({ hasText: "confirmed locally" }).waitFor();
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  console.log(
    "PASS: settings gallery, 36 viewport/theme/accent combinations, canonical swatches/switch fill, notification dependencies, native focus/busy/Escape/return, instant reduced motion, zero remote requests or screenshots.",
  );
} finally {
  await browser.close();
}
