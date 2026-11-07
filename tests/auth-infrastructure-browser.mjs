import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const origin = process.env.UI_BASE_URL ?? "http://127.0.0.1:5175";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
});
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let refreshFailure = true;
  let probes = 0;
  let releaseProbe;
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({
      status: refreshFailure ? 503 : 401,
      contentType: "application/json",
      body: JSON.stringify({ error: refreshFailure ? "unavailable" : "no_session" }),
    }),
  );
  await page.route("https://supabase.test/**", async (route) => {
    if (route.request().method() === "HEAD") {
      probes++;
      await new Promise((resolve) => {
        releaseProbe = resolve;
      });
      return route.fulfill({ status: 200, headers: { "content-range": "0-0/1" }, body: "" });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.goto(`${origin}/auth/login`);
  await page.getByRole("heading", { name: "Let’s reconnect" }).waitFor();
  assert.ok(await page.locator(".infrastructure-notice[role=alert]").isVisible());
  refreshFailure = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  await page.clock.install();
  const probeRequest = page.waitForRequest((r) => r.method() === "HEAD");
  // Exercise the actual exported health store and mounted recovery hook, without a test route.
  await page.evaluate(async () => {
    const { useSupabaseHealth } = await import("/src/lib/supabase-health.ts");
    useSupabaseHealth.getState().markDown();
  });
  await probeRequest;
  await page.getByRole("alert").filter({ hasText: "Connection issues" }).waitFor();
  assert.equal(probes, 1);
  // Query's singleton focus manager is the exact dependency imported by the mounted hook.
  const healthModule = await page.request.get(`${origin}/src/lib/use-connection-health.ts`);
  const source = await healthModule.text();
  const dependency = source.match(/from\s+"([^"]*tanstack_react-query[^"]*)"/)[1];
  assert.equal(
    await page.evaluate(async (path) => (await import(path)).focusManager.isFocused(), dependency),
    false,
  );
  releaseProbe();
  await page.locator(".connection-banner-v2").waitFor({ state: "detached" });
  assert.equal(
    await page.evaluate(async (path) => (await import(path)).focusManager.isFocused(), dependency),
    true,
  );
  await page.clock.runFor(31_000);
  assert.equal(probes, 1, "recovery cancels the probe interval");
  assert.deepEqual(errors, []);
  await page.close();
  // A fresh page isolates a failed lazy module from the successful recovery journey.
  const failed = await browser.newPage();
  await failed.route("**/api/auth/refresh", (r) =>
    r.fulfill({ status: 401, contentType: "application/json", body: '{"error":"no_session"}' }),
  );
  await failed.route("**/src/routes/auth.error.tsx*", (r) => r.abort("failed"));
  await failed.goto(`${origin}/auth/error`);
  await failed.getByRole("heading", { name: "Something went wrong", exact: true }).waitFor();
  await failed.getByText("This page couldn’t be opened. Please try again.").waitFor();
  assert.ok(await failed.getByRole("button", { name: "Try again", exact: true }).isVisible());
  await failed.getByRole("link", { name: "Return home", exact: true }).click();
  await failed.getByRole("heading", { name: "Good conversations need their own space." }).waitFor();
  console.log(
    "PASS auth infrastructure: session bootstrap error/reload recovery; mounted outage alert, half-open HEAD probe, focus suppression/restoration and timer cleanup; failed lazy-route error card and home recovery. No screenshots or real sessions.",
  );
} finally {
  await browser.close();
}
