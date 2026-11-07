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
  const tilePalettes = new Map();
  assert.equal(await gallery.locator('[data-slot="file-icon-tile"]').count(), 14);
  assert.equal(await gallery.locator(".message-file .lucide-download").count(), 14);
  assert.equal(
    await gallery
      .locator('[data-file-sample="Renamed spreadsheet.pdf"] [data-file-family="spreadsheet"]')
      .count(),
    2,
  );
  for (const [width, height] of [
    [375, 844],
    [768, 1024],
    [1280, 900],
  ]) {
    await page.setViewportSize({ width, height });
    for (const mode of ["light", "dark"]) {
      await page
        .getByRole("button", { name: mode === "light" ? "Light" : "Dark", exact: true })
        .click();
      for (const accent of ["blue", "purple", "red", "orange", "yellow", "green"]) {
        await page.getByRole("combobox", { name: "Accent" }).selectOption(accent);
        await page.evaluate(() =>
          Promise.all(
            document
              .getAnimations()
              .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
              .map((animation) => animation.finished.catch(() => {})),
          ),
        );
        const tiles = await gallery
          .locator('[data-slot="file-icon-tile"]')
          .evaluateAll((elements) =>
            elements.map((el) => {
              const style = getComputedStyle(el);
              const glyph = getComputedStyle(el.querySelector("svg"));
              const bounds = el.getBoundingClientRect();
              return {
                family: el.dataset.fileFamily,
                color: style.color,
                glyph: glyph.color,
                fill: style.backgroundColor,
                border: style.borderTopColor,
                borderWidth: style.borderTopWidth,
                radius: style.borderRadius,
                width: bounds.width,
                height: bounds.height,
                label: el.parentElement.querySelector("small").textContent,
                hidden: el.getAttribute("aria-hidden"),
              };
            }),
          );
        assert.equal(new Set(tiles.map((tile) => tile.color)).size, 6);
        for (const tile of tiles) {
          assert.equal(tile.hidden, "true");
          assert.equal(tile.width, 48);
          assert.equal(tile.height, 48);
          assert.equal(tile.borderWidth, "1px");
          assert.equal(tile.radius, "50%");
          assert.equal(tile.glyph, tile.color);
          assert.notEqual(tile.fill, tile.color);
          assert.notEqual(tile.border, tile.fill);
          assert.match(
            tile.label,
            /^248 KB · (PDF Document|Spreadsheet|Word Document|Presentation|Text \/ Notes|File)$/,
          );
          if (tile.family === "unknown")
            assert.equal(tile.color, mode === "light" ? "rgb(255, 255, 255)" : "rgb(17, 24, 39)");
          const key = mode + tile.family;
          const palette = [tile.color, tile.fill, tile.border];
          if (tilePalettes.has(key))
            assert.deepEqual(
              palette,
              tilePalettes.get(key),
              "File hues must not depend on accent, bubble direction or viewport",
            );
          else tilePalettes.set(key, palette);
        }
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
    "PASS: offline conversation gallery; 36 viewport/theme/accent combinations; MIME-first file labels, six fixed family hues, circular tiles and tray downloads; own glow, neutral incoming, borderless sticker, content containment, static audio, dates/unread/reactions/deleted/system, safe links, local media; no auth or remote requests.",
  );
} finally {
  await browser.close();
}
