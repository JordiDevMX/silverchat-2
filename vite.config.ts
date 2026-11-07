import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { uiReviewLinks } from "./scripts/vite-ui-review.ts";

// "@" → "src/" path alias. Mirrors the "paths" mapping in tsconfig.app.json.
// Manual alias per Prompt #2 §6 (vite-tsconfig-paths OR manual resolve.alias).
const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
};

export default defineConfig(({ mode }) => ({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(
      JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version,
    ),
  },
  plugins: [uiReviewLinks(mode === "ui-review"), react(), tailwindcss()],
  resolve: { alias },
  // Keep review independent of app credentials and of the app server's dependency cache.
  envDir: mode === "ui-review" ? false : undefined,
  cacheDir: mode === "ui-review" ? "node_modules/.vite-ui-review" : undefined,
  optimizeDeps: mode === "ui-review" ? { entries: ["tests/ui-foundation.html"] } : undefined,
  server: { host: "127.0.0.1", port: mode === "ui-review" ? 5177 : 5173, strictPort: true },
}));
