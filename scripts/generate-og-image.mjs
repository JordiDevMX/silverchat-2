#!/usr/bin/env node
/**
 * Renders public/og-image.png (1200x630), the Open Graph / Twitter Card image.
 *
 * The card is built from the assets already shipped in public/:
 *   - public/icons/icon-512x512.png  -> the SilverChat "S" badge
 *   - Inter Variable (latin subset)  -> the wordmark, matching the app UI
 *
 * Rendering goes through headless Chrome so the result is deterministic and
 * needs no image-processing dependency. Chrome is located automatically; set
 * CHROME_PATH to override.
 *
 * Usage: node scripts/generate-og-image.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUTPUT = join(ROOT, "public", "og-image.png");
const BADGE = join(ROOT, "public", "icons", "icon-512x512.png");
const FONT = join(
  ROOT,
  "node_modules",
  "@fontsource-variable",
  "inter",
  "files",
  "inter-latin-wght-normal.woff2",
);

const WIDTH = 1200;
const HEIGHT = 630;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      `No Chrome/Chromium binary found. Set CHROME_PATH to the browser executable. Tried:\n${CHROME_CANDIDATES.join("\n")}`,
    );
  }
  return found;
}

const toDataUri = (filePath, mimeType) =>
  `data:${mimeType};base64,${readFileSync(filePath).toString("base64")}`;

function buildHtml() {
  const badge = toDataUri(BADGE, "image/png");
  const font = toDataUri(FONT, "font/woff2");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face {
        font-family: "Inter";
        src: url("${font}") format("woff2");
        font-weight: 100 900;
        font-style: normal;
        font-display: block;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
      /* Flat background on purpose: alpha gradients make the rasterizer dither,
         which inflates the PNG from ~48 KB to ~460 KB for no visible gain. */
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: "Inter", system-ui, sans-serif;
        background: #eef2f8;
      }
      .card {
        display: flex;
        align-items: center;
        gap: 40px;
        padding: 56px 72px;
      }
      .badge {
        width: 176px;
        height: 176px;
      }
      .copy { display: flex; flex-direction: column; gap: 20px; }
      .wordmark {
        display: flex;
        font-size: 108px;
        font-weight: 700;
        letter-spacing: -0.035em;
        line-height: 1;
        color: #0c1723;
      }
      .wordmark .chat { color: #0082ff; }
      .tagline {
        font-size: 34px;
        font-weight: 500;
        letter-spacing: -0.01em;
        color: #3c4a5e;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <img class="badge" src="${badge}" alt="" />
      <div class="copy">
        <div class="wordmark">Silver<span class="chat">Chat</span></div>
        <div class="tagline">Privacy-first messaging</div>
      </div>
    </main>
  </body>
</html>
`;
}

const chrome = findChrome();
const workDir = mkdtempSync(join(tmpdir(), "silverchat-og-"));
try {
  const htmlPath = join(workDir, "og.html");
  const shotPath = join(workDir, "og.png");
  writeFileSync(htmlPath, buildHtml(), "utf8");

  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--screenshot=${shotPath}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      `--user-data-dir=${join(workDir, "profile")}`,
      htmlPath,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  if (!existsSync(shotPath)) {
    throw new Error("Chrome did not produce a screenshot");
  }
  writeFileSync(OUTPUT, readFileSync(shotPath));
  console.log(`Wrote ${OUTPUT} (${WIDTH}x${HEIGHT})`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
