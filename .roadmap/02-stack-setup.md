# SILVERCHAT — PROMPT #2: STACK & PROJECT SETUP

You are a senior frontend engineer setting up the foundation of **SilverChat**,
a production-grade messaging web app (React + TypeScript) with a futuristic
silver + electric blue design language and a privacy-first philosophy.

The developer is **frontend-only** (comfortable with React, TypeScript, and
Tailwind CSS; **no backend experience**). Every decision below is **final and
agreed upon**. Do not propose alternatives unless you identify a genuine
blocker — in that case, explain it briefly and propose the minimal fix.

This prompt covers **project scaffolding and tooling only**. Do NOT implement
features, UI components, or domain logic yet. Those come in later prompts.

---

## 1. STACK (LOCKED)

| Layer              | Tool / Version                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Bundler            | **Vite 6+**                                                                                        |
| Framework          | **React 19** (functional components + hooks)                                                       |
| Language           | **TypeScript** (`strict: true`)                                                                    |
| Package manager    | **pnpm** (enforced via `only-allow`)                                                               |
| Router             | **TanStack Router (SPA mode, v1)** — **NOT TanStack Start**                                        |
| Server state       | **TanStack Query v5**                                                                              |
| Auth state         | Supabase Auth + React Context                                                                      |
| UI state           | **Zustand**                                                                                        |
| Forms              | **react-hook-form** + **Zod**                                                                      |
| Icons              | **lucide-react**                                                                                   |
| Styling            | **Tailwind CSS v4** (CSS-first config via `@theme`)                                                |
| Animation          | **Pure CSS + native View Transitions API** (`document.startViewTransition`) with graceful fallback |
| Linter / Formatter | **Biome** (single tool: lint + format)                                                             |
| Backend client     | `@supabase/supabase-js` + auto-generated types                                                     |
| Supabase CLI       | `supabase` CLI (for type generation and later migrations)                                          |

**Backend infrastructure (from Prompt #1):** Supabase (DB/Auth/Storage/Realtime),
LiveKit Cloud (calls), Resend (emails), Netlify (frontend hosting).

---

## 2. WHY TANSTACK ROUTER (NOT TANSTACK START)

This is a **critical constraint**, do not override it:

1. SilverChat is an **SPA by design**. All major web messengers (WhatsApp Web,
   Telegram Web, Discord, Slack) are SPAs.
2. **SSR and PWA offline caching conflict** with each other — hard to
   reconcile, not worth the pain for a messaging app.
3. **SEO is irrelevant** for chat content. The only SEO-relevant surface is
   the Open Graph card, which is solved with static meta tags.
4. TanStack Start is still evolving; the developer should not debug a
   meta-framework during their first full-stack project.

**→ Use TanStack Router v1 in SPA mode.** All the type-safe routing power,
zero SSR overhead. Native browser back/forward works out of the box.

---

## 3. TAILWIND CSS v4 — CSS-FIRST CONFIGURATION

Do **not** use `tailwind.config.js`. Tailwind v4 uses a **CSS-first** approach:

- Design tokens (colors, radii, spacing, typography, shadows) live inside
  `src/styles/globals.css` under the `@theme` directive.
- Plugin registration uses `@plugin` in CSS, not JS.
- Vite plugin: `@tailwindcss/vite` (not PostCSS).

Example structure (do not paste verbatim; adapt to the actual design system
defined in Prompt #3):

```css
@import "tailwindcss";

@theme {
  --color-silver-50: #f5f6f8;
  /* ... full palette comes in Prompt #3 */
  --radius-lg: 16px;
  --font-sans: "Inter", system-ui, sans-serif;
}

@layer base {
  /* global resets, focus-visible rings, etc. */
}
```

Rule of thumb: domain-specific logic → features/<feature>/. Shared,
domain-agnostic pieces → components/, hooks/, or lib/.

6. TYPESCRIPT CONFIGURATION
   Requirements:

"strict": true

"noUncheckedIndexedAccess": true

"noImplicitOverride": true

"noFallthroughCasesInSwitch": true

"verbatimModuleSyntax": true

Path alias: "@/_": ["./src/_"] (mirrored in vite.config.ts via
vite-tsconfig-paths or manual resolve.alias).

Separate tsconfig.app.json and tsconfig.node.json if Vite's default
template already splits them — keep the split.

7. package.json SCRIPTS (LOCKED)
   json
   {
   "scripts": {
   "preinstall": "npx only-allow pnpm",
   "dev": "vite",
   "build": "tsc -b && vite build",
   "preview": "vite preview",
   "lint": "biome check .",
   "lint:fix": "biome check --write .",
   "typecheck": "tsc --noEmit",
   "db:types": "supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/types/database.ts"
   }
   }
   preinstall must block npm and yarn with a clear error.

db:types regenerates TypeScript types from the live Supabase schema — this
is how the developer stays type-safe without manually writing DB types.

8. ENVIRONMENT VARIABLES
   Only variables safe to expose to the browser. All prefixed VITE\_.

.env.example (committed to the repo):

text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
.env.local (gitignored) holds real values.

VITE_SUPABASE_ANON_KEY is safe to expose only because RLS is enabled.
Make this explicit in .env.example via comments.

Never put service role keys, LiveKit API secrets, or Resend API keys in
VITE\_\* variables. Those live in Supabase Edge Function secrets.

9. GITHUB REPOSITORY
   Remote: https://github.com/JordiDevMX/silverchat-2.git

Default branch: main

Include a .gitignore covering: node_modules, .env.local, dist,
supabase/.branches, supabase/.temp, .DS_Store, editor files.

Include a minimal README.md with:

Project name + one-line description

Prerequisites: Node 20+, pnpm 9+, Supabase CLI

Setup: pnpm install → copy .env.example → pnpm dev

Link to the roadmap of prompts (reference: this project is being built
incrementally through 16 spec prompts)

Do not run git push — the developer commits and pushes manually.

10. INITIAL PROVIDERS TREE (SKELETON ONLY)
    Create the file structure for providers but leave them mostly empty
    placeholders (real implementations come in later prompts):

text
<QueryClientProvider>
<ThemeProvider> {/_ stub — Prompt #14 _/}
<I18nProvider> {/_ stub — Prompt #14 _/}
<AuthProvider> {/_ stub — Prompt #5 _/}
<RouterProvider router={router} />
</AuthProvider>
</I18nProvider>
</ThemeProvider>
</QueryClientProvider>
The router config can start with a single placeholder route (/) rendering a
"SilverChat — bootstrapping" text. Real routes come in Prompt #7+.

11. SUPABASE CLIENT (MINIMAL)
    src/lib/supabase.ts should export a typed client:

ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const supabase = createClient<Database>(
import.meta.env.VITE_SUPABASE_URL,
import.meta.env.VITE_SUPABASE_ANON_KEY
);
src/types/database.ts will initially be empty/placeholder. It gets
regenerated via pnpm db:types once the schema exists (Prompt #4).

Do not add auth helpers yet — those come in Prompt #5.

12. BIOME CONFIGURATION
    biome.json should include:

Formatter: 2-space indent, double quotes, semicolons always, line width 100.

Linter: recommended rules enabled, noUnusedImports and noUnusedVariables
as errors.

Organize imports on save.

Ignore: dist, node_modules, src/types/database.ts (auto-generated).

13. WHAT TO DO NOT DO IN THIS PROMPT
    ❌ Do NOT implement any UI components beyond a placeholder <App />.

❌ Do NOT create the design system tokens (Prompt #3).

❌ Do NOT define the data model (Prompt #4).

❌ Do NOT wire up auth (Prompt #5).

❌ Do NOT add service worker / PWA manifest (Prompt #13).

❌ Do NOT install shadcn/ui, motion, framer-motion, or any component
library. Design system is 100% custom.

❌ Do NOT use tailwind.config.js (v4 does not need it).

14. HOW TO RESPOND
    Respond in this exact order:

A one-paragraph confirmation that you understood every locked decision
above (this verifies alignment before running any command).

Step-by-step setup commands to scaffold the project, in a code block
ready to paste. Each step with a short comment explaining what it does.
Include:

pnpm create vite invocation (React + TypeScript template)

Installing all dependencies (tanstack-router, tanstack-query,
zustand, react-hook-form, zod, lucide-react, @supabase/supabase-js,
tailwindcss@4, @tailwindcss/vite, @biomejs/biome, vite-tsconfig-paths,
and CLI supabase)

Registering the Vite plugin and path alias

Setting up the folder structure

Configuring Biome

Creating .env.example and .gitignore

Adding the scripts block to package.json

Connecting to the GitHub remote (no push)

Full content of every config file the developer must create or edit:
vite.config.ts, tsconfig.json (and app/node variants if applicable),
biome.json, src/styles/globals.css (empty @theme block, tokens added
in Prompt #3), src/lib/supabase.ts, src/app/main.tsx,
src/app/App.tsx, src/app/router.tsx, src/app/providers/ stubs,
.env.example, .gitignore, README.md, .npmrc if needed for pnpm.

A verification checklist the developer can run manually to confirm
everything works before moving to Prompt #3 (e.g. "run pnpm dev, open
localhost:5173, you should see …", "run pnpm typecheck with zero errors",
"run pnpm lint with zero errors").

A short list of common pitfalls to watch for during this setup, phrased
for a frontend developer with no backend experience (e.g. why pnpm and
not npm, why VITE\_ prefix matters, why .env.local must never be
committed).

Output code and commands, but keep the scope strictly to scaffolding. No
feature implementation.
