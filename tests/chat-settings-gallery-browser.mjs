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
  await page.goto(`${origin}/tests/ui-foundation.html#chat-settings-gallery`);
  await page.waitForLoadState("networkidle");
  const gallery = page.locator("#chat-settings-gallery");
  await gallery.getByRole("heading", { name: "Chat settings & info", exact: true }).waitFor();
  const bounds = async (el, width, height) => {
    const b = await el.boundingBox();
    assert.ok(b.x >= -1 && b.y >= -1 && b.x + b.width <= width + 1 && b.y + b.height <= height + 1);
    assert.ok(await el.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
  };
  for (const [width, height] of [
    [375, 844],
    [768, 1024],
    [1280, 900],
  ]) {
    await page.setViewportSize({ width, height });
    for (const mode of ["light", "dark"])
      for (const accent of ["blue", "purple", "red", "orange", "yellow", "green"]) {
        await page.evaluate(
          ({ mode, accent }) => {
            document.documentElement.dataset.theme = mode;
            document.documentElement.className = `theme-${accent}`;
          },
          { mode, accent },
        );
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${width}/${mode}/${accent}`,
        );
        assert.equal(await gallery.locator(".group-member-v2").count(), 3);
        await gallery.getByRole("tab", { name: "Preview files", exact: true }).click();
        for (const family of ["pdf", "word", "spreadsheet", "presentation", "unknown", "text"])
          assert.equal(await gallery.locator(`[data-file-family="${family}"]`).count(), 1);
        const word = gallery.locator(".shared-file-row-v2").filter({ hasText: "notes.txt" });
        assert.equal(
          await word.locator('[data-file-family="word"]').count(),
          1,
          "MIME wins over misleading extension",
        );
        for (const row of await gallery.locator(".shared-file-row-v2").all())
          assert.ok(await row.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
        await gallery.getByRole("tab", { name: "Preview files", exact: true }).press("ArrowLeft");
        assert.ok(
          await gallery
            .getByRole("tab", { name: "Preview media", exact: true })
            .evaluate((el) => el === document.activeElement),
        );
        assert.equal(await gallery.locator(".shared-media-tile-v2").count(), 6);
        const trigger = gallery.getByRole("button", { name: "Preview chat options", exact: true });
        await trigger.click();
        const menu = page.getByRole("menu", { name: "Preview chat options", exact: true });
        await menu.waitFor();
        await bounds(menu, width, height);
        await page.keyboard.press("End");
        assert.equal(await page.locator(":focus").textContent(), "Preview leave group");
        await page.keyboard.press("Home");
        assert.equal(await page.locator(":focus").textContent(), "Preview group info");
        await page.keyboard.press("Escape");
        await menu.waitFor({ state: "detached" });
        assert.ok(await trigger.evaluate((el) => el === document.activeElement));
        for (const [button, title] of [
          ["Preview contact card", "Preview contact profile"],
          ["Preview add members", "Preview add members"],
          ["Preview report", "Preview report"],
        ]) {
          const opener = gallery.getByRole("button", { name: button, exact: true });
          await opener.click();
          const dialog = page.getByRole("dialog", { name: title, exact: true });
          await dialog.waitFor();
          await bounds(dialog, width, height);
          assert.equal(
            await dialog
              .locator(".motion-overlay-body")
              .evaluate((el) => getComputedStyle(el).animationName),
            "settings-enter",
          );
          await dialog.getByRole("button", { name: "Cancel chat preview", exact: true }).focus();
          await page.keyboard.press("Tab");
          assert.equal(await dialog.locator(":focus").count(), 1);
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "detached" });
          assert.ok(await opener.evaluate((el) => el === document.activeElement));
        }
      }
  }
  // Reopening during exit must invalidate the prior dismissal timer, even at the same point.
  const trigger = gallery.getByRole("button", { name: "Preview chat options", exact: true });
  await trigger.click();
  await page.keyboard.press("Escape");
  await trigger.evaluate((el) => el.click());
  await page.waitForTimeout(220);
  const menu = page.getByRole("menu", { name: "Preview chat options", exact: true });
  assert.ok(await menu.isVisible());
  await menu.getByRole("menuitem", { name: "Preview pin", exact: true }).click();
  await gallery.getByRole("status").filter({ hasText: "Chat pinned locally." }).waitFor();
  await gallery.getByRole("button", { name: "Preview add members", exact: true }).click();
  let dialog = page.getByRole("dialog");
  assert.ok(
    await dialog.getByRole("button", { name: "Confirm chat preview", exact: true }).isDisabled(),
  );
  await dialog.getByRole("checkbox", { name: /Dave Park/ }).check();
  await dialog.getByRole("checkbox", { name: "Preview pending action", exact: true }).check();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  assert.ok(await dialog.evaluate((el) => el.open));
  assert.ok(
    await dialog.getByRole("button", { name: "Confirm chat preview", exact: true }).isDisabled(),
  );
  await dialog.getByRole("checkbox", { name: "Preview pending action", exact: true }).uncheck();
  await dialog.getByRole("button", { name: "Confirm chat preview", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  await gallery.getByRole("button", { name: "Preview report", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Other", exact: true }).check();
  assert.ok(
    await dialog.getByRole("button", { name: "Confirm chat preview", exact: true }).isDisabled(),
  );
  await dialog.getByLabel("Preview report description", { exact: true }).fill("Local preview text");
  await dialog.getByRole("button", { name: "Confirm chat preview", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  for (const label of ["Preview clear chat", "Preview leave group", "Preview mute"]) {
    await gallery.getByRole("button", { name: label, exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel chat preview", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
  }
  await gallery.getByRole("button", { name: "Preview open image", exact: true }).first().click();
  await page.getByText("Local lightbox frame — no media request", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await trigger.click();
  assert.equal(
    await page.getByRole("menu").evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("menu").count(), 0);
  await gallery.getByRole("button", { name: "Preview contact card", exact: true }).click();
  dialog = page.getByRole("dialog");
  assert.equal(
    await dialog
      .locator(".motion-overlay-body")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await dialog.getByRole("button", { name: "Cancel chat preview", exact: true }).click();
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  console.log(
    "PASS chat-settings gallery: 36 viewport/theme/accent combinations, shared info/member/contact surfaces, all six MIME-first families, tab keyboard, menu positioning/keyboard/rapid reopen, dialogs/busy/focus return, local confirmations, reduced motion, zero remote requests or screenshots.",
  );
} finally {
  await browser.close();
}
