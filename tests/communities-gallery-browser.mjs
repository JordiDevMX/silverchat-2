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
  await page.goto(`${origin}/tests/ui-foundation.html#communities-gallery`);
  const gallery = page.locator("#communities-gallery");
  await gallery.getByRole("heading", { name: "Communities", exact: true }).waitFor();
  const toggle = gallery.locator(".community-card-heading");
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  await toggle.click();
  assert.equal(await gallery.locator(".community-card-chats").isVisible(), false);
  await toggle.click();
  assert.equal(await gallery.locator(".community-card-chats").isVisible(), true);
  assert.equal(await gallery.getByLabel("Muted preview chat").count(), 2);
  assert.equal(await gallery.getByLabel("Unread preview chat").count(), 2);
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
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.ok(
          await gallery
            .locator(".community-card,.community-sidebar,.community-preview-detail")
            .evaluateAll((elements) =>
              elements.every((el) => el.scrollWidth <= el.clientWidth + 1),
            ),
          `${width}/${mode}/${accent}: containment`,
        );
        const active = await gallery
          .locator('[aria-current="page"] .community-chat-icon')
          .evaluate((el) => ({
            image: getComputedStyle(el).backgroundImage,
            color: getComputedStyle(el).color,
          }));
        const primary = await page
          .getByRole("button", { name: "Follow", exact: true })
          .evaluate((el) => ({
            image: getComputedStyle(el).backgroundImage,
            color: getComputedStyle(el).color,
          }));
        assert.deepEqual(active, primary);
      }
    const trigger = gallery.getByRole("button", { name: "Open community creation preview" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Preview new community" });
    await dialog.waitFor();
    assert.ok((await dialog.boundingBox()).width <= width);
    await dialog.getByLabel("Preview community name").fill("Sunday walks");
    await dialog.getByRole("button", { name: "Create preview community" }).focus();
    await page.keyboard.press("Tab");
    assert.equal(await dialog.locator(":focus").count(), 1);
    await dialog.getByRole("button", { name: "Create preview community" }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.match(await gallery.getByRole("status").textContent(), /Sunday walks/);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  console.log(
    "PASS: offline communities cards, expansion, active/sidebar/header/info, unread/muted badges and creation focus; 36 viewport/theme/accent combinations; no auth/network or screenshots.",
  );
} finally {
  await browser.close();
}
