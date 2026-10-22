import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// "@" → "src/" path alias. Mirrors the "paths" mapping in tsconfig.app.json.
// Manual alias per Prompt #2 §6 (vite-tsconfig-paths OR manual resolve.alias).
const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
};

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(
      JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version,
    ),
  },
  plugins: [react(), tailwindcss()],
  resolve: { alias },
});
