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
  await page.goto(`${origin}/#settings-details-gallery`);
  await page.waitForLoadState("networkidle");
  const gallery = page.locator("#settings-details-gallery");
  await gallery
    .getByRole("heading", { name: "Profile, account & security", exact: true })
    .waitFor();
  const contained = async (dialog, width, height) => {
    const b = await dialog.boundingBox();
    assert.ok(b.width <= width && b.height <= height);
    assert.ok(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
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
          `${width}/${mode}/${accent} document containment`,
        );
        for (const el of await gallery.locator(".settings-card,.public-profile-card-v2").all())
          assert.ok(await el.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
        const photo = gallery.getByRole("button", { name: "Preview photo picker", exact: true });
        await photo.click();
        const dialog = page.getByRole("dialog");
        await dialog.waitFor();
        await contained(dialog, width, height);
        assert.equal(
          await dialog
            .locator(".motion-overlay-body")
            .evaluate((el) => getComputedStyle(el).animationName),
          "settings-enter",
        );
        await dialog.getByRole("button", { name: "Preview upload crop", exact: true }).click();
        await dialog.getByLabel(/Zoom/).fill("2");
        await contained(dialog, width, height);
        await dialog.getByRole("button", { name: "Cancel photo preview", exact: true }).click();
        await dialog.waitFor({ state: "detached" });
        assert.ok(await photo.evaluate((el) => el === document.activeElement));
        await gallery.getByRole("button", { name: "Preview backup codes", exact: true }).click();
        await dialog.waitFor();
        await contained(dialog, width, height);
        assert.equal(await dialog.locator(".backup-grid code").count(), 10);
        assert.ok(
          await dialog
            .getByRole("button", { name: "Done with preview codes", exact: true })
            .isDisabled(),
        );
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
        assert.ok(await dialog.evaluate((el) => el.open));
        await dialog
          .getByRole("checkbox", { name: "I’ve saved these demo codes", exact: true })
          .check();
        await dialog.getByRole("button", { name: "Done with preview codes", exact: true }).click();
        await dialog.waitFor({ state: "detached" });
      }
  }
  await gallery.getByRole("button", { name: "Preview unblock", exact: true }).click();
  await gallery
    .getByText("Optimistic preview: contact removed while saving.", { exact: true })
    .waitFor();
  await gallery.getByRole("button", { name: "Simulate unblock failure", exact: true }).click();
  await gallery.getByRole("alert").waitFor();
  await gallery.getByText("User 22222222", { exact: true }).waitFor();
  await gallery.getByRole("button", { name: "Preview delete confirmation", exact: true }).click();
  let dialog = page.getByRole("dialog");
  assert.ok(
    await dialog
      .getByRole("button", { name: "Schedule preview deletion", exact: true })
      .isDisabled(),
  );
  await dialog.getByLabel("Type DELETE to confirm preview", { exact: true }).fill("DELETE");
  await dialog.getByRole("button", { name: "Schedule preview deletion", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await gallery
      .locator(".public-profile-card-v2")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await gallery.getByRole("button", { name: "Preview photo picker", exact: true }).click();
  dialog = page.getByRole("dialog");
  assert.equal(
    await dialog
      .locator(".motion-overlay-body")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await dialog.getByRole("button", { name: "Cancel photo preview", exact: true }).click();
  assert.equal(await page.locator("dialog.settings-dialog").count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  console.log(
    "PASS settings detail gallery: 36 viewport/theme/accent combinations; profile/social/public card containment; avatar crop frame and focus return; typed deletion; optimistic rollback; mandatory code acknowledgment; instant reduced motion; zero remote requests or screenshots.",
  );
} finally {
  await browser.close();
}
