import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
// The fixture cannot call a remote service, even if a future import accidentally introduces one.
await page.route("**/*", (route) => {
  const url = new URL(route.request().url());
  return url.hostname === "127.0.0.1" || url.protocol === "data:"
    ? route.continue()
    : route.abort();
});
try {
  await page.goto(`${process.env.UI_BASE_URL ?? "http://127.0.0.1:5173"}/tests/ui-foundation.html`);
  await page.getByRole("heading", { name: "SilverChat", exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const requestToggle = page.getByRole("button", { name: "Message requests 2" });
  assert.equal(await requestToggle.getAttribute("aria-expanded"), "false");
  await requestToggle.focus();
  await page.keyboard.press("Enter");
  await page.getByText("Request previews appear only after you open this section.").waitFor();
  await page.keyboard.press("Space");
  assert.equal(await requestToggle.getAttribute("aria-expanded"), "false");
  assert.equal(
    await page.getByText("Request previews appear only after you open this section.").count(),
    0,
  );
  // Glow is a primitive contract, including Slot composition and disabled states.
  for (const target of [
    page.getByRole("button", { name: "Follow", exact: true }),
    page.getByRole("button", { name: "Create channel", exact: true }),
    page.getByRole("switch", { name: "Glow enabled" }),
    page.getByLabel("12 unread messages"),
  ]) {
    assert.match(await target.evaluate((el) => getComputedStyle(el).boxShadow), /24px/);
  }
  assert.match(
    await page
      .getByRole("button", { name: "Follow", exact: true })
      .evaluate((el) => getComputedStyle(el).backgroundImage),
    /linear-gradient/,
  );
  assert.match(
    await page.getByLabel("Neon identity").evaluate((el) => getComputedStyle(el).backgroundImage),
    /radial-gradient/,
  );
  const composed = page.getByRole("link", { name: "Install preview" });
  assert.equal(await composed.getAttribute("data-slot"), "button");
  assert.equal(await composed.getAttribute("type"), null);
  await composed.focus();
  assert.equal(await composed.evaluate((el) => document.activeElement === el), true);
  assert.match(await composed.evaluate((el) => getComputedStyle(el).boxShadow), /1px/);
  assert.doesNotMatch(
    await page
      .getByRole("button", { name: "Disabled primary" })
      .evaluate((el) => getComputedStyle(el).boxShadow),
    /24px|32px/,
  );
  // Utilities must beat legacy .settings-form input rules. Button defaults must not submit.
  assert.equal(
    await page.locator("#review-name").evaluate((el) => getComputedStyle(el).height),
    "44px",
  );
  await page.getByRole("button", { name: "Default button", exact: true }).click();
  assert.equal(await page.getByLabel("Submissions").textContent(), "0");
  await page.getByRole("button", { name: "Save changes" }).click();
  assert.equal(await page.getByLabel("Submissions").textContent(), "1");
  await page.getByRole("switch", { name: "Message notifications" }).click();
  assert.equal(
    await page.getByRole("switch", { name: "Message notifications" }).getAttribute("aria-checked"),
    "false",
  );
  await page.getByLabel("Digit 1", { exact: true }).fill("123456");
  for (let i = 1; i <= 6; i++)
    assert.equal(await page.getByLabel(`Digit ${i}`, { exact: true }).inputValue(), String(i));
  await page.getByLabel("Photo fallback").getByText("FP").waitFor();
  await page.getByRole("button", { name: "Replace photo" }).click();
  await page.getByLabel("Photo fallback").locator("img").waitFor();
  // Existing native modal: busy Escape prevention, nested focus ownership and restoration.
  await page.getByRole("button", { name: "Existing modal", exact: true }).click();
  const native = page.getByRole("dialog", { name: "Existing modal", exact: true });
  await native.getByLabel("Prevent dismissal").check();
  await page.keyboard.press("Escape");
  assert.equal(await native.isVisible(), true);
  await native.getByLabel("Prevent dismissal").uncheck();
  await native.getByRole("button", { name: "Nested modal", exact: true }).click();
  const nested = page.getByRole("dialog", { name: "Nested modal", exact: true });
  await nested.getByRole("button", { name: "Close nested" }).focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await nested.getByLabel("Nested field").evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  await nested.waitFor({ state: "hidden" });
  assert.equal(
    await native
      .getByRole("button", { name: "Nested modal", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  await native.waitFor({ state: "hidden" });
  assert.equal(
    await page
      .getByRole("button", { name: "Existing modal", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  // Radix focus restoration and menu keyboard selection.
  await page.getByRole("button", { name: "New dialog" }).click();
  await page.getByRole("dialog", { name: "Start a conversation" }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Start a conversation" }).waitFor({ state: "hidden" });
  assert.equal(
    await page
      .getByRole("button", { name: "New dialog" })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: "Chat actions" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Mute", exact: true }).waitFor();
  await page.keyboard.press("Enter");
  await page
    .getByRole("status")
    .filter({ hasText: /^Muted$/ })
    .waitFor();
  await page.getByRole("button", { name: "Profile popover" }).click();
  await page.getByText("Profile details", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByText("Profile details", { exact: true }).waitFor({ state: "hidden" });
  await page.getByRole("link", { name: "Member details" }).focus();
  await page.getByText("Community member", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Light", exact: true }).focus();
  await page.getByText("Community member", { exact: true }).waitFor({ state: "hidden" });
  // Every accent must have a distinct primary and valid semantic surfaces in both modes.
  for (const mode of ["light", "dark"]) {
    const primaries = new Set();
    const glows = new Set();
    const bubbleGlows = new Set();
    for (const accent of ["blue", "purple", "red", "orange", "yellow", "green"]) {
      await page.evaluate(
        ({ mode, accent }) => {
          document.documentElement.dataset.theme = mode;
          document.documentElement.className = `theme-${accent}`;
        },
        { mode, accent },
      );
      const colors = await page
        .locator("[data-token]")
        .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).backgroundColor));
      assert.equal(colors.length, 6);
      assert.ok(colors.every((value) => value !== "rgba(0, 0, 0, 0)" && value !== "transparent"));
      primaries.add(colors.at(-1));
      const brand = page.locator('[data-slot="brand-mark"]').first();
      assert.equal(
        await brand.evaluate((el) => getComputedStyle(el).backgroundColor),
        colors.at(-1),
      );
      assert.equal(await brand.evaluate((el) => getComputedStyle(el).color), "rgb(255, 255, 255)");
      const own = page.locator('[data-slot="bubble-surface"][data-own="true"]');
      const bubbleShadow = await own.evaluate((el) => getComputedStyle(el).boxShadow);
      assert.match(bubbleShadow, mode === "dark" ? /32px/ : /24px/);
      assert.match(
        await own.evaluate((el) => getComputedStyle(el).backgroundImage),
        /linear-gradient/,
      );
      assert.equal(
        await page
          .locator('[data-slot="bubble-surface"][data-own="false"]')
          .evaluate((el) => getComputedStyle(el).boxShadow),
        "none",
      );
      bubbleGlows.add(bubbleShadow);
      glows.add(
        await page
          .getByRole("button", { name: "Follow", exact: true })
          .evaluate((el) => getComputedStyle(el).boxShadow),
      );
    }
    assert.equal(primaries.size, 6);
    assert.equal(glows.size, 6);
    assert.equal(bubbleGlows.size, 6);
    await page.evaluate(() => {
      document.documentElement.className = "theme-blue";
    });
  }
  // Explicit light remains light under dark OS preference; absent theme has a semantic fallback.
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Light", exact: true }).click();
  const light = await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.evaluate(() => {
    delete document.documentElement.dataset.theme;
  });
  const systemDark = await page
    .locator("body")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.notEqual(light, systemDark);
  assert.ok(
    parseFloat(
      await page
        .locator('[data-slot="skeleton"]')
        .evaluate((el) => getComputedStyle(el).animationDuration),
    ) <= 0.00001,
  );
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole("button", { name: "New dialog" }).click();
    await page
      .getByRole("dialog", { name: "Start a conversation" })
      .evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
    const box = await page.getByRole("dialog", { name: "Start a conversation" }).boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width && box.y >= 0);
    await page.getByRole("button", { name: "Dismiss dialog" }).click();
    await page.getByRole("button", { name: "Preferences sheet" }).click();
    const sheet = page.getByRole("dialog", { name: "Preferences", exact: true });
    await sheet.evaluate((el) =>
      Promise.all(el.getAnimations().map((animation) => animation.finished)),
    );
    const sheetBox = await sheet.boundingBox();
    assert.ok(sheetBox.x >= 0 && sheetBox.x + sheetBox.width <= width);
    await page.getByRole("button", { name: "Dismiss preferences" }).click();
  }
  await page.setViewportSize({ width: 375, height: 900 });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      result: "passed",
      checks:
        "cascade, glow/disabled/focus-ring composition, Slot link, ambient light, buttons, switches, OTP, avatar recovery, modal nesting/focus, menu keyboard, popovers, 12 theme/accent combinations, system theme, reduced motion, 3 viewport widths",
    }),
  );
} finally {
  await browser.close();
}
