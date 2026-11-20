import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Resolve a local Chromium/Chrome executable across Linux, macOS, and Windows so
 * browser suites run without manual CHROMIUM_PATH configuration.
 */
function findChromiumExecutable(chromium) {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;

  try {
    const managed = chromium.executablePath();
    if (managed && existsSync(managed)) return managed;
  } catch {
    // Fall through to system browsers when Playwright's managed binary is absent.
  }

  const candidates =
    process.platform === "win32"
      ? [
          process.env.PROGRAMFILES &&
            join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
          process.env["PROGRAMFILES(X86)"] &&
            join(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
          process.env.LOCALAPPDATA &&
            join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
          ...findMsPlaywrightWindowsExecutables(),
          process.env["PROGRAMFILES(X86)"] &&
            join(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
          process.env.PROGRAMFILES &&
            join(process.env.PROGRAMFILES, "Microsoft/Edge/Application/msedge.exe"),
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          ]
        : [
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/usr/bin/google-chrome",
            "/usr/bin/microsoft-edge",
          ];

  return candidates.find((candidate) => candidate && existsSync(candidate));
}

function findMsPlaywrightWindowsExecutables() {
  const root = process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "ms-playwright");
  if (!root || !existsSync(root)) return [];
  try {
    return readdirSync(root)
      .filter((entry) => entry.startsWith("chromium-"))
      .sort()
      .reverse()
      .map((entry) => join(root, entry, "chrome-win64/chrome.exe"));
  } catch {
    return [];
  }
}

/** Launch headless Chromium via playwright-core with zero-config executable discovery. */
export async function launchBrowser(options = {}) {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
  const executablePath = findChromiumExecutable(chromium);
  if (!executablePath) {
    throw new Error(
      "No Chromium/Chrome executable found. Set CHROMIUM_PATH or run `pnpm exec playwright-core install chromium`.",
    );
  }
  return chromium.launch({
    headless: true,
    ...options,
    executablePath,
  });
}
