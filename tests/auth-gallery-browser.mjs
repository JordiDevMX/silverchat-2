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
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.origin !== origin || u.pathname.startsWith("/api/")) remote.push(r.url());
  });
  await page.goto(`${origin}/tests/ui-foundation.html#auth-gallery`);
  const gallery = page.locator("#auth-gallery");
  await gallery.getByRole("heading", { name: "Auth, onboarding & infrastructure" }).waitFor();
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
          `${width}/${mode}/${accent} page overflow`,
        );
        for (const card of await gallery.locator(".auth-card-v2").all())
          assert.ok(
            await card.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
            "card overflow",
          );
        assert.equal(await gallery.locator(".auth-card-v2").count(), 10);
        const login = gallery
          .locator(".auth-card-v2")
          .filter({ has: page.getByRole("heading", { name: "Preview login", exact: true }) });
        assert.ok(
          await login
            .getByLabel("Email address")
            .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft) >= 40),
          "email text clears its icon",
        );
        await login.getByLabel("Email address").fill("review@example.test");
        await login.getByRole("button", { name: "Preview send link" }).click();
        await gallery.getByText("Preview link sent. No email was sent.").waitFor();
        const otp = gallery.locator(".code-field");
        await otp.getByLabel("Digit 1", { exact: true }).fill("123456");
        for (let i = 1; i <= 6; i++)
          assert.equal(await otp.getByLabel(`Digit ${i}`, { exact: true }).inputValue(), String(i));
        await gallery.getByRole("button", { name: "Toggle code error" }).click();
        assert.equal(
          await otp.getByLabel("Digit 1", { exact: true }).getAttribute("aria-invalid"),
          "true",
        );
        await gallery.getByRole("button", { name: "Toggle code error" }).click();
        const trigger = gallery.getByRole("button", {
          name: "Preview session expired",
          exact: true,
        });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "Preview session has expired" });
        await dialog.waitFor();
        await page.keyboard.press("Escape");
        assert.ok(await dialog.isVisible(), "session expiry cannot be dismissed");
        await page.keyboard.press("Tab");
        assert.ok(await dialog.evaluate((el) => el.contains(document.activeElement)));
        assert.ok(await dialog.evaluate((el) => el.getBoundingClientRect().width <= innerWidth));
        await dialog.getByRole("button", { name: "Preview return to login" }).click();
        assert.ok(await trigger.evaluate((el) => el === document.activeElement));
      }
  }
  const otp = gallery.locator(".code-field");
  await otp.getByLabel("Digit 1", { exact: true }).evaluate((el) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", "98x76 54");
    el.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData }));
  });
  assert.equal(
    await otp.locator("input").evaluateAll((nodes) => nodes.map((n) => n.value).join("")),
    "987654",
  );
  await otp.getByLabel("Digit 6", { exact: true }).fill("");
  await otp.getByLabel("Digit 6", { exact: true }).press("Backspace");
  assert.ok(
    await otp
      .getByLabel("Digit 5", { exact: true })
      .evaluate((el) => el === document.activeElement),
  );
  await gallery.getByLabel("Preview pending request", { exact: true }).check();
  for (const name of ["Preview verify", "Preview continue", "Preview get started", "Preview skip"])
    assert.ok(await gallery.getByRole("button", { name, exact: true }).isDisabled());
  await gallery.getByLabel("Preview pending request", { exact: true }).uncheck();
  await gallery.getByRole("button", { name: "Preview use backup code", exact: true }).click();
  await gallery.getByLabel("Backup code", { exact: true }).fill("DEMO123456");
  await gallery.getByRole("button", { name: "Preview use authenticator", exact: true }).click();
  assert.equal(
    await otp.locator("input").evaluateAll((nodes) => nodes.map((n) => n.value).join("")),
    "",
  );
  await gallery.getByLabel("Preview username", { exact: true }).fill("preview_name");
  await gallery.getByText("Your handle: @preview_name", { exact: true }).waitFor();
  await gallery.getByLabel("Preview appearance", { exact: true }).selectOption("dark");
  await gallery.getByRole("button", { name: "purple", exact: true }).click();
  await gallery.getByRole("button", { name: "Preview get started", exact: true }).click();
  await gallery.getByText("Preview preferences: dark, purple. Nothing persisted.").waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await gallery
      .locator(".auth-card-v2")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await gallery.getByRole("button", { name: "Preview session expired", exact: true }).click();
  assert.equal(
    await page.getByRole("dialog").evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await page.getByRole("button", { name: "Preview return to login" }).click();
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  console.log(
    "PASS auth gallery: 36 viewport/theme/accent combinations; landing/forms/cards containment, OTP change/paste/backspace/error, local preferences, pending controls, mandatory session dialog/focus, instant reduced motion; zero auth/remote requests or screenshots.",
  );
} finally {
  await browser.close();
}
