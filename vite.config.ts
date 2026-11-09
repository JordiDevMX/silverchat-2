import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// "@" → "src/" path alias. Mirrors the "paths" mapping in tsconfig.app.json.
// Manual alias per Prompt #2 §6 (vite-tsconfig-paths OR manual resolve.alias).
const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
};

const allowedDevtoolsPlugins = new Set([
  "@tanstack/devtools:inject-source",
  "@tanstack/devtools:custom-server",
  "@tanstack/devtools:remove-devtools-on-build",
]);

const tanstackDevtools = devtools({
  injectSource: { enabled: true },
  removeDevtoolsOnBuild: true,
  eventBusConfig: { enabled: false },
  enhancedLogs: { enabled: false },
  consolePiping: { enabled: false },
  editor: {
    name: "VSCode",
    open: async (filePath, lineNumber, columnNumber) => {
      const target = `${filePath}${lineNumber ? `:${lineNumber}` : ""}${columnNumber ? `:${columnNumber}` : ""}`;
      if (process.platform === "win32") {
        execFile("cmd.exe", ["/d", "/s", "/c", "code", "-r", "-g", target], { windowsHide: true });
      } else {
        execFile("code", ["-r", "-g", target]);
      }
    },
  },
}).filter((plugin) => allowedDevtoolsPlugins.has(plugin.name));

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(
      JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version,
    ),
  },
  plugins: [...tanstackDevtools, react(), tailwindcss()],
  resolve: { alias },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
