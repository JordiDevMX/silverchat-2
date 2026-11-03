import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
});
// Silent PCM stays in memory. The manual-review gallery never mounts media elements.
const wav = Buffer.alloc(44 + 8000 * 8 * 2);
wav.write("RIFF", 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24);
wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(wav.length - 44, 40);
try {
  const page = await browser.newPage();
  await page.route("**/contract-audio.wav", (route) => {
    const range = route
      .request()
      .headers()
      .range?.match(/bytes=(\d+)-(\d*)/);
    const start = Number(range?.[1] ?? 0);
    const end = Math.min(Number(range?.[2] || wav.length - 1), wav.length - 1);
    return route.fulfill({
      status: range ? 206 : 200,
      contentType: "audio/wav",
      headers: {
        "Accept-Ranges": "bytes",
        ...(range ? { "Content-Range": `bytes ${start}-${end}/${wav.length}` } : {}),
      },
      body: wav.subarray(start, end + 1),
    });
  });
  await page.route("**/contract-invalid.wav", (route) =>
    route.fulfill({ contentType: "audio/wav", body: "invalid" }),
  );
  await page.goto(`${process.env.UI_BASE_URL ?? "http://127.0.0.1:5173"}/tests/voice-player.html`);
  const first = page.locator('[data-player="first"]'),
    second = page.locator('[data-player="second"]');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-player]:not([data-player="error"]) audio')].every(
      (el) => el.duration === 8 && el.seekable.length > 0 && el.seekable.end(0) === 8,
    ),
  );
  assert.equal(await first.getByRole("slider").getAttribute("max"), "8");
  await first.getByRole("button", { name: "Play audio" }).click();
  await first.getByRole("button", { name: "Pause audio" }).waitFor();
  await first.getByRole("button", { name: "Pause audio" }).click();
  assert.ok(await first.locator("audio").evaluate((el) => el.paused));
  await first.getByRole("slider").focus();
  await first.getByRole("slider").press("Home");
  await first.getByRole("slider").press("ArrowRight");
  await page.waitForFunction(
    () => document.querySelector('[data-player="first"] audio').currentTime >= 0.09,
  );
  await first.getByRole("button", { name: "Play audio" }).click();
  await second.getByRole("button", { name: "Play audio" }).click();
  await second.getByRole("button", { name: "Pause audio" }).waitFor();
  assert.ok(await first.locator("audio").evaluate((el) => el.paused && el.currentTime === 0));
  await second.getByRole("slider").fill("7.9");
  await second.getByRole("button", { name: "Play audio" }).waitFor();
  assert.ok(await second.locator("audio").evaluate((el) => el.paused && el.currentTime === 0));
  await second.getByRole("button", { name: "Play audio" }).click();
  await second.locator("audio").evaluate((el) => {
    window.__contractAudio = el;
  });
  await page.getByRole("button", { name: "Unmount second player" }).click();
  assert.ok(
    await page.evaluate(
      () => window.__contractAudio.paused && window.__contractAudio.currentTime === 0,
    ),
  );
  await page.locator('[data-player="error"]').getByRole("alert").waitFor();
  console.log(
    "PASS: real VoicePlayer metadata/duration, play/pause, range seek, exclusive replacement/reset, ended reset, error and unmount cleanup; silent in-memory audio, no screenshots.",
  );
} finally {
  await browser.close();
}
