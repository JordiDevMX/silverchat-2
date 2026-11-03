// User-facing review journey: real HTTP/ESM, fresh contexts, no auth mocks or screenshots.
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
});
const origin = process.env.UI_REVIEW_URL ?? "http://127.0.0.1:5177";
const fixture = "/tests/ui-foundation.html";
try {
  for (const pathname of [
    "/",
    fixture,
    "/ui-foundation.html",
    "/ui-review",
    "/chats",
    "/communities",
    "/settings/appearance",
  ]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    const documents = [];
    const appRequests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.request().resourceType() === "document")
        documents.push({ path: new URL(response.url()).pathname, status: response.status() });
      if (response.status() >= 400)
        errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.pathname.startsWith("/api/") ||
        url.pathname === "/src/app/main.tsx" ||
        (url.protocol.startsWith("http") && url.origin !== origin)
      )
        appRequests.push(url.pathname);
    });
    const response = await page.goto(`${origin}${pathname}`);
    assert.equal(response.status(), 200);
    const isFixture = ["/", fixture, "/ui-foundation.html", "/ui-review"].includes(pathname);
    if (isFixture) {
      await page.getByRole("heading", { name: "SilverChat", exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(new URL(page.url()).pathname, fixture);
      assert.equal(await page.locator('[data-slot="brand-lockup"]').count(), 2);
      assert.equal(
        await page.locator('[data-slot="bubble-surface"]:not(#conversation-gallery *)').count(),
        2,
      );
      assert.equal(await page.locator('[data-slot="floating-action-button"]').count(), 4);
      assert.equal(await page.locator(".request-toggle").getAttribute("aria-expanded"), "false");
      assert.equal(
        await page.getByRole("searchbox").evaluate((el) => getComputedStyle(el).borderWidth),
        "0px",
      );
      assert.match(
        await page
          .locator('[data-slot="search-field"]')
          .evaluate((el) => getComputedStyle(el).backgroundImage),
        /linear-gradient/,
      );
      assert.match(
        await page
          .locator('[data-slot="bubble-surface"]:not(#conversation-gallery *)[data-own="true"]')
          .evaluate((el) => getComputedStyle(el).boxShadow),
        /24px/,
      );
      assert.equal(await page.locator('script[src="/src/app/main.tsx"]').count(), 0);
      assert.equal(
        await page
          .locator("script[src]")
          .evaluateAll(
            (scripts) =>
              scripts.filter(
                (script) => new URL(script.src).pathname === "/tests/ui-foundation.tsx",
              ).length,
          ),
        1,
      );
    } else {
      await page.getByRole("heading", { name: "This is the UI review server" }).waitFor();
      assert.equal(
        await page
          .getByRole("link", { name: "Open the SilverChat review fixture" })
          .getAttribute("href"),
        fixture,
      );
      assert.equal(await page.locator("script").count(), 0);
    }
    await page.waitForLoadState("networkidle");
    assert.deepEqual(errors, []);
    assert.deepEqual(appRequests, []);
    console.log(
      JSON.stringify({
        path: pathname,
        documents,
        finalPath: new URL(page.url()).pathname,
        result: isFixture ? "migrated fixture rendered" : "backend requirement explained",
        consoleErrors: 0,
        appOrAuthRequests: 0,
      }),
    );
    await context.close();
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  const diskUrl = pathToFileURL(fileURLToPath(new URL("./ui-foundation.html", import.meta.url)));
  await page.goto(diskUrl.href);
  await page
    .getByRole("heading", { name: "SilverChat UI review — start the local server" })
    .waitFor();
  assert.equal(
    await page.getByRole("link").getAttribute("href"),
    "http://127.0.0.1:5177/tests/ui-foundation.html",
  );
  assert.equal(await page.locator('[data-slot="brand-lockup"]').count(), 0);
  console.log(
    "file:// is unsupported; the HTML now displays the exact command and working HTTP link instead of a blank page.",
  );
  await context.close();
} finally {
  await browser.close();
}
