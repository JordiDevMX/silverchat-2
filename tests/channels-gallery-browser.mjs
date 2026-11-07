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
  await page.goto(`${origin}/tests/ui-foundation.html#channels-gallery`);
  await page.waitForLoadState("networkidle");
  const gallery = page.locator("#channels-gallery");
  await gallery.getByRole("heading", { name: "Broadcast channels", exact: true }).waitFor();
  assert.equal(await gallery.locator(".channel-list-item").count(), 2);
  assert.equal(
    await gallery.getByRole("button", { name: "Edit preview channel", exact: true }).count(),
    0,
  );
  await gallery.getByRole("button", { name: "Follow preview", exact: true }).click();
  assert.equal(
    await gallery
      .getByRole("button", { name: "Following preview", exact: true })
      .getAttribute("data-following"),
    "true",
  );
  await gallery.getByRole("button", { name: "Mute preview notifications", exact: true }).click();
  await gallery.getByRole("status").filter({ hasText: "muted locally" }).waitFor();
  await gallery.getByRole("button", { name: "Unfollow preview info", exact: true }).click();
  assert.equal(
    await gallery.getByRole("button", { name: "Mute preview notifications", exact: true }).count(),
    0,
  );
  await gallery.getByRole("button", { name: "Preview owner account", exact: true }).click();
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
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${width}/${mode}/${accent} containment`,
        );
        const primary = await gallery
          .getByRole("button", { name: "Follow preview", exact: true })
          .evaluate((el) => getComputedStyle(el).backgroundImage);
        assert.equal(
          primary,
          await page
            .getByRole("button", { name: "Follow", exact: true })
            .evaluate((el) => getComputedStyle(el).backgroundImage),
        );
        const trigger = gallery.getByRole("button", {
          name: "Create preview channel",
          exact: true,
        });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "Create preview channel", exact: true });
        await dialog.waitFor();
        assert.ok(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
        assert.equal(
          await dialog
            .locator(".motion-overlay-body")
            .evaluate((el) => getComputedStyle(el).animationName),
          "story-enter",
        );
        await dialog.getByRole("button", { name: "Confirm preview channel", exact: true }).focus();
        await page.keyboard.press("Tab");
        assert.equal(await dialog.locator(":focus").count(), 1);
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "detached" });
        assert.ok(await trigger.evaluate((el) => el === document.activeElement));
      }
  }
  await gallery.getByRole("button", { name: "Edit preview channel", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Edit preview channel", exact: true });
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("Updated local channel");
  await dialog.getByRole("button", { name: "Confirm preview channel", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await gallery
      .locator(".channel-row-reveal")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await gallery.getByRole("button", { name: "Delete preview channel", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Delete preview channel", exact: true });
  assert.equal(
    await dialog
      .locator(".motion-overlay-body")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await dialog.getByRole("button", { name: "Cancel preview channel", exact: true }).click();
  assert.equal(await page.locator(".channel-overlay").count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  console.log(
    "PASS: channels gallery, 36 viewport/theme/accent combinations, follows, owner controls, overlay focus/exit, instant reduced motion, no remote requests or images.",
  );
} finally {
  await browser.close();
}
