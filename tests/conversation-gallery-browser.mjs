// Offline manual-review contract: fresh browser, local assets, no session or screenshots.
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const origin = process.env.UI_REVIEW_URL ?? "http://127.0.0.1:5177";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
});
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const errors = [];
  const remote = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin || url.pathname.startsWith("/api/")) remote.push(request.url());
  });
  await page.goto(`${origin}/tests/ui-foundation.html#conversation-gallery`);
  const gallery = page.locator("#conversation-gallery");
  await gallery.getByRole("heading", { name: "Conversation timeline" }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await gallery.locator("audio,video,textarea").count(), 0);
  assert.equal(await gallery.locator(".voice-track rect").count(), 80);
  assert.equal(await gallery.locator(".message-system").count(), 1);
  assert.equal(await gallery.locator(".message-deleted").count(), 2);
  assert.equal(await gallery.locator("[data-unread-marker]").count(), 1);
  assert.equal(await gallery.locator(".message-date").textContent(), "Today");
  assert.equal(await gallery.locator(".message-reactions [aria-pressed=true]").count(), 1);
  const link = gallery.getByRole("link", { name: "example.com" });
  assert.equal(await link.getAttribute("href"), "https://example.com");
  assert.equal(await link.getAttribute("rel"), "noopener noreferrer nofollow");
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const mode of ["light", "dark"]) {
      await page
        .getByRole("button", { name: mode === "light" ? "Light" : "Dark", exact: true })
        .click();
      for (const accent of ["blue", "purple", "red", "orange", "yellow", "green"]) {
        await page.getByRole("combobox", { name: "Accent" }).selectOption(accent);
        const surfaces = await gallery
          .locator('[data-slot="bubble-surface"]')
          .evaluateAll((elements) =>
            elements.map((el) => {
              const style = getComputedStyle(el);
              return {
                own: el.dataset.own === "true",
                shadow: style.boxShadow,
                image: style.backgroundImage,
                width: el.clientWidth,
                content: el.scrollWidth,
                radius: parseFloat(style.borderBottomRightRadius),
                topRadius: parseFloat(style.borderTopLeftRadius),
              };
            }),
          );
        for (const surface of surfaces) {
          assert.ok(
            surface.content <= surface.width + 1,
            `${width}/${mode}/${accent}: bubble clips content`,
          );
          if (surface.own) {
            assert.match(surface.image, /linear-gradient/);
            assert.match(surface.shadow, mode === "dark" ? /32px/ : /24px/);
            assert.ok(surface.radius < surface.topRadius);
          } else assert.equal(surface.image, "none");
        }
        assert.equal(
          await gallery
            .locator('[data-slot="sticker-surface"]')
            .evaluate((el) => getComputedStyle(el).boxShadow),
          "none",
        );
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.ok(
          await gallery
            .locator(".conversation-header")
            .evaluate((el) => el.scrollWidth <= el.clientWidth),
        );
        assert.ok(
          await gallery
            .locator(".message-image img")
            .evaluateAll((elements) => elements.every((el) => el.complete && el.naturalWidth > 0)),
        );
      }
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  console.log(
    "PASS: offline conversation gallery; 36 viewport/theme/accent combinations; own glow, neutral incoming, borderless sticker, content containment, static audio, dates/unread/reactions/deleted/system, safe links, local media; no auth or remote requests.",
  );
} finally {
  await browser.close();
}
