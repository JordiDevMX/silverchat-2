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
  const panel = gallery.locator(".community-card-chats");
  assert.equal(await toggle.getAttribute("aria-controls"), await panel.getAttribute("id"));
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  await toggle.focus();
  await toggle.press("Enter");
  assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  assert.equal(await panel.isVisible(), false);
  assert.deepEqual(
    await panel.evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      opacity: getComputedStyle(el).opacity,
      animations: el.getAnimations().length,
      inert: el.inert,
      hidden: el.getAttribute("aria-hidden"),
    })),
    { height: 0, opacity: "0", animations: 0, inert: true, hidden: "true" },
  );
  await page.keyboard.press("Tab");
  assert.equal(await panel.evaluate((el) => el.contains(document.activeElement)), false);
  await toggle.press("Space");
  assert.equal(await panel.isVisible(), true);
  assert.equal(await panel.evaluate((el) => el.getAnimations().length), 0);
  assert.equal(await toggle.evaluate((el) => el === document.activeElement), true);
  await page.keyboard.press("Tab");
  assert.equal(await panel.evaluate((el) => el.contains(document.activeElement)), true);
  assert.equal(await gallery.getByLabel("Muted preview chat").count(), 2);
  assert.equal(await gallery.getByLabel("Unread preview chat").count(), 2);
  for (const [width, height] of [
    [375, 844],
    [768, 1024],
    [1280, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "no-preference" });
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
        // Inspect actual CSS transitions at their midpoint, avoiding wall-clock timing races.
        for (const open of [false, true]) {
          const sample = await gallery.locator(".community-card").evaluate(async (card) => {
            const button = card.querySelector(".community-card-heading");
            const content = card.querySelector(".community-card-chats");
            const frame = () => new Promise(requestAnimationFrame);
            const before = content.getBoundingClientRect().height;
            button.click();
            await frame();
            const animations = content.getAnimations();
            const motions = animations.filter((a) => a.transitionProperty !== "visibility");
            const timings = motions.map((a) => a.effect.getTiming());
            for (const animation of animations) {
              animation.pause();
              animation.currentTime = 100;
            }
            await frame();
            const middle = content.getBoundingClientRect().height;
            const opacity = Number(getComputedStyle(content).opacity);
            const inert = content.inert;
            const hidden = content.getAttribute("aria-hidden");
            for (const animation of animations) animation.finish();
            const after = content.getBoundingClientRect().height;
            return {
              before,
              middle,
              after,
              opacity,
              inert,
              hidden,
              expanded: button.getAttribute("aria-expanded"),
              timings,
              properties: motions.map((a) => a.transitionProperty).sort(),
              visibility: getComputedStyle(content).visibility,
            };
          });
          assert.deepEqual(sample.properties, ["grid-template-rows", "opacity"]);
          assert.ok(
            sample.timings.every(
              (t) => t.duration === 200 && t.easing === "cubic-bezier(0.2, 0, 0, 1)",
            ),
          );
          assert.ok(sample.middle > 0 && sample.middle < Math.max(sample.before, sample.after));
          assert.ok(sample.opacity > 0 && sample.opacity < 1);
          assert.equal(sample.expanded, String(open));
          assert.equal(sample.inert, !open);
          assert.equal(sample.hidden, String(!open));
          assert.equal(sample.visibility, open ? "visible" : "hidden");
          if (!open) assert.equal(sample.after, 0);
        }
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
    "PASS: offline communities cards, 200ms height/opacity transitions, instant reduced motion, keyboard/inert focus, active/sidebar/header/info, unread/muted badges and creation focus; 36 viewport/theme/accent combinations; no auth/network or screenshots.",
  );
} finally {
  await browser.close();
}
