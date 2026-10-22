# SILVERCHAT — PROMPT #16: DEPLOYMENT & METADATA

You are a senior DevOps engineer finalizing the **deployment, monitoring,
and documentation** of SilverChat. This is the **last prompt** of the
16-section roadmap. It does not add any user-facing feature — it makes the
app **production-ready, deployable, and maintainable**.

This prompt covers: Netlify config, GitHub Actions CI, Sentry error tracking,
health check endpoint, OG metadata, robots/sitemap, `.env.example`, README,
deployment guide.

**Not covered here**: custom domain + Cloudflare (Fase 2 — MVP uses
`*.netlify.app`), analytics (Fase 2), automated backups (Fase 2 — MVP uses
documented manual `pg_dump`).

All decisions are **final and locked**.

---

## 1. LOCKED DECISIONS

| #   | Decision                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------- |
| D1  | Sentry free tier (5k events/month) for error tracking, both frontend and backend                                             |
| D2  | **No analytics** in MVP (add Umami self-hosted when scale demands)                                                           |
| D3  | GitHub Actions for CI (typecheck + lint + build), Netlify auto-deploy on push to `main`; Supabase migrations stay **manual** |
| D4  | MVP uses `*.netlify.app` subdomain; **custom domain + Cloudflare is Fase 2**                                                 |
| D5  | Static OG card (`/public/og-image.png`, 1200×630)                                                                            |
| D6  | `/health` public JSON endpoint for uptime monitoring                                                                         |
| D7  | `robots.txt` restrictive (no index of app routes) + minimal `sitemap.xml`                                                    |
| D8  | Manual `pg_dump` documented in README (no automated backups in MVP)                                                          |
| D9  | Complete `README.md` + `docs/DEPLOY.md` step-by-step                                                                         |

Additional locked decisions:

- **Netlify site name**: developer's choice during setup, e.g.
  `silverchat-app.netlify.app`.
- **Sentinel release tagging**: Sentry release = git commit SHA + short
  version (e.g. `silverchat@1.0.0+abc123f`).
- **Source maps**: uploaded to Sentry at build, **never** served publicly.
- **Health check**: returns 200 with `{ status: 'ok' }` if frontend is up;
  probes Supabase and LiveKit with 2-second timeouts; aggregate status is
  `degraded` if any dependency is down but the app itself is up.
- **OG image**: developer provides the PNG. Prompt provides the meta tags
  and filename.
- **`.env.example`**: committed. `.env.local`: gitignored.
- **README**: includes a "Fase 2 roadmap" section documenting every deferred
  item across all 16 prompts, so nothing is lost.
- **Manual DB backup**: document `pg_dump` command + retention (keep last 3).

---

## 2. FILE STRUCTURE

silverchat/
├── .github/
│ └── workflows/
│ └── ci.yml (NEW)
├── docs/
│ ├── DEPLOY.md (NEW)
│ └── FASE-2.md (NEW)
├── public/
│ ├── \_redirects (NEW)
│ ├── og-image.png (developer provides)
│ ├── robots.txt (NEW)
│ └── sitemap.xml (NEW)
├── src/
│ ├── app/
│ │ ├── App.tsx (modified — Sentry Error Boundary)
│ │ └── main.tsx (modified — Sentry.init)
│ ├── lib/
│ │ └── sentry.ts (NEW — centralized init)
│ └── routes/
│ └── health.tsx (NEW — public route)
├── .env.example (updated — all vars)
├── netlify.toml (NEW)
├── vite.config.ts (modified — Sentry plugin)
├── package.json (modified — sentry scripts)
└── README.md (rewritten)

text

---

## 3. DEPENDENCIES

````bash
pnpm add @sentry/react @sentry/vite-plugin
Optional (only if adding backend error tracking — recommended for later):

bash
# In supabase/functions/ each function can `pnpm add @sentry/deno` locally
Sentry for Netlify Functions is Fase 2 (documented).

4. src/lib/sentry.ts
ts
import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.info('[sentry] DSN not configured — skipping initialization');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // 'development' | 'production'
    release: import.meta.env.VITE_APP_VERSION,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,       // privacy: never capture text
        blockAllMedia: true,     // privacy: never capture media
        maskAllInputs: true,
      }),
    ],
    // Performance: sample 10% of transactions to stay within free tier
    tracesSampleRate: 0.1,
    // Replay: sample 5% of sessions, 100% of error sessions
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    // Don't send common noise
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'Failed to fetch', // offline is expected
    ],
    beforeSend(event) {
      // Do not send errors from browser extensions
      if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
        f => f.filename?.includes('extension://')
      )) {
        return null;
      }
      // Do not send errors containing auth tokens in URLs
      if (event.request?.url?.match(/[?&](access_token|refresh_token)=/)) {
        return null;
      }
      return event;
    },
  });

  Sentry.setUser({
    // Use the Supabase user id if logged in (set elsewhere via Sentry.setUser)
    // On logout, call Sentry.setUser(null)
  });
}

export { Sentry };
Wire in src/app/main.tsx:

tsx
import { initSentry } from './lib/sentry';
initSentry();

import './lib/i18n';
// ...rest
Wire in src/lib/auth-provider.tsx (from #5):

On login success: Sentry.setUser({ id: user.id })

On logout: Sentry.setUser(null)

Wire in src/app/App.tsx:

tsx
import { Sentry } from '@/lib/sentry';

export function App() {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-muted-foreground mb-6">
            We've been notified and are working on it.
          </p>
          <button
            onClick={resetError}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 font-semibold"
          >
            Try again
          </button>
        </div>
      )}
    >
      {/* existing provider tree */}
    </Sentry.ErrorBoundary>
  );
}
5. vite.config.ts — Sentry plugin
Add the Sentry Vite plugin to upload source maps at build (they are not
served publicly):

ts
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  build: {
    sourcemap: true, // generate source maps
  },
  plugins: [
    react(),
    tsconfigPaths(),
    VitePWA({ /* ... */ }),
    // Sentry plugin — only in production builds with auth token
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            sourcemaps: {
              assets: ['./dist/**/*.js', './dist/**/*.js.map'],
            },
          }),
        ]
      : []),
  ],
});
Environment variables (Netlify build env, not client-visible):

SENTRY_ORG

SENTRY_PROJECT

SENTRY_AUTH_TOKEN

Client-visible:

VITE_SENTRY_DSN

VITE_APP_VERSION (injected at build via define or .env)

Add to vite.config.ts:

ts
define: {
  'import.meta.env.VITE_APP_VERSION': JSON.stringify(
    `silverchat@${process.env.npm_package_version}+${process.env.COMMIT_REF ?? 'dev'}`
  ),
},
COMMIT_REF is set automatically by Netlify during build.

6. .github/workflows/ci.yml
yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Build
        run: pnpm build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_VAPID_PUBLIC_KEY: ${{ secrets.VITE_VAPID_PUBLIC_KEY }}
          VITE_TURNSTILE_SITE_KEY: ${{ secrets.VITE_TURNSTILE_SITE_KEY }}
          VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
Note: Netlify's Git integration handles the deploy itself when CI
passes. Netlify only deploys if the CI job succeeds because Netlify is
configured (in the Netlify UI) to "Wait for CI checks to pass before
deploying" — or the developer disables Netlify's auto-deploy and uses a
Deploy Hook triggered from GitHub Actions:

yaml
      - name: Deploy to Netlify
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: |
          curl -X POST -d '' "${{ secrets.NETLIFY_BUILD_HOOK }}"
Recommendation: use Netlify's built-in Git integration with "Wait for
CI" enabled. It's simpler than managing deploy hooks. The workflow above
just fails CI on bad code, and Netlify will refuse to deploy.

7. netlify.toml
toml
[build]
  command = "pnpm build"
  publish = "dist"
  functions = "netlify/functions"

[build.environment]
  NODE_VERSION = "20"
  PNPM_VERSION = "9"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

# SPA fallback — all other routes go to index.html
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(self), microphone=(self), geolocation=(), interest-cohort=()"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://browser.sentry-cdn.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://*.livekit.io; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.livekit.io wss://*.livekit.io https://challenges.cloudflare.com https://*.sentry.io; font-src 'self' data:; media-src 'self' blob: https://*.supabase.co; frame-src https://challenges.cloudflare.com; worker-src 'self' blob:; frame-ancestors 'none';"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
    Service-Worker-Allowed = "/"

[[headers]]
  for = "/manifest.webmanifest"
  [headers.values]
    Content-Type = "application/manifest+json"
    Cache-Control = "public, max-age=3600"

[functions]
  node_bundler = "esbuild"
  external_node_modules = ["@supabase/supabase-js"]
Security headers rationale:

X-Frame-Options: DENY — prevents clickjacking

X-Content-Type-Options: nosniff — prevents MIME confusion

Referrer-Policy — doesn't leak URLs to third parties

Permissions-Policy — disables features not used (geolocation, etc.)

Strict-Transport-Security — forces HTTPS

CSP — restricts origins for scripts, styles, images, connections,
iframes. Covers: Cloudflare Turnstile, Supabase, LiveKit, Sentry.
Adjust if new third-party services are added.

8. public/_redirects
Netlify prefers _redirects over netlify.toml for simple SPA fallback
(they're both valid; netlify.toml handles it already but _redirects is
belt-and-suspenders):

text
/api/*  /.netlify/functions/:splat  200
/*      /index.html                 200
9. index.html — complete meta tags
html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0EA5E9" />

    <!-- Primary meta -->
    <title>SilverChat — Privacy-first messaging</title>
    <meta
      name="description"
      content="A privacy-first messaging app with a futuristic silver aesthetic. Real-time chats, voice and video calls, and end-to-end privacy."
    />
    <link rel="canonical" href="https://silverchat-app.netlify.app/" />

    <!-- Open Graph (Facebook, LinkedIn, WhatsApp, Telegram) -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="SilverChat" />
    <meta property="og:title" content="SilverChat — Privacy-first messaging" />
    <meta
      property="og:description"
      content="A privacy-first messaging app with a futuristic silver aesthetic. Real-time chats, voice and video calls, and end-to-end privacy."
    />
    <meta property="og:image" content="https://silverchat-app.netlify.app/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="SilverChat logo over a silver and electric blue gradient" />
    <meta property="og:url" content="https://silverchat-app.netlify.app/" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:locale:alternate" content="es_MX" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="SilverChat — Privacy-first messaging" />
    <meta
      name="twitter:description"
      content="A privacy-first messaging app with a futuristic silver aesthetic. Real-time chats, voice and video calls, and end-to-end privacy."
    />
    <meta name="twitter:image" content="https://silverchat-app.netlify.app/og-image.png" />
    <meta name="twitter:image:alt" content="SilverChat logo over a silver and electric blue gradient" />

    <!-- PWA -->
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/icons/icon-180.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="SilverChat" />

    <!-- JSON-LD (structured data) -->
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "SilverChat",
        "url": "https://silverchat-app.netlify.app/",
        "description": "A privacy-first messaging app with a futuristic silver aesthetic.",
        "applicationCategory": "SocialNetworkingApplication",
        "operatingSystem": "Any",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        },
        "inLanguage": ["en", "es"]
      }
    </script>

    <!-- FOUC prevention script (from Prompt #14) -->
    <script>
      /* ... inline script from Prompt #14 ... */
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/app/main.tsx"></script>
  </body>
</html>
10. src/routes/health.tsx
tsx
import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/lib/supabase';

const PROBE_TIMEOUT_MS = 2000;
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';

async function probeSupabase(): Promise<'ok' | 'down'> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const { error } = await supabase
      .from('app_config')
      .select('key')
      .limit(1)
      .abortSignal(controller.signal);
    clearTimeout(timer);
    return error ? 'down' : 'ok';
  } catch {
    return 'down';
  }
}

async function probeLiveKit(): Promise<'ok' | 'down' | 'unknown'> {
  const url = import.meta.env.VITE_LIVEKIT_URL;
  if (!url) return 'unknown';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    // LiveKit exposes /settings on the HTTP(S) equivalent of the WS URL
    const httpUrl = url.replace(/^ws/, 'http');
    const res = await fetch(httpUrl + '/settings', {
      signal: controller.signal,
      method: 'GET',
    });
    clearTimeout(timer);
    return res.ok ? 'ok' : 'down';
  } catch {
    return 'down';
  }
}

export const Route = createFileRoute('/health')({
  loader: async () => {
    const [supabaseStatus, livekitStatus] = await Promise.all([
      probeSupabase(),
      probeLiveKit(),
    ]);

    const anyDown = supabaseStatus === 'down' || livekitStatus === 'down';

    return {
      status: anyDown ? 'degraded' : 'ok',
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      services: {
        supabase: supabaseStatus,
        livekit: livekitStatus,
      },
    };
  },
  component: HealthPage,
});

function HealthPage() {
  const data = Route.useLoaderData();
  return (
    <pre
      style={{
        fontFamily: 'monospace',
        padding: '2rem',
        background: '#0F172A',
        color: '#E2E8F0',
        minHeight: '100vh',
        margin: 0,
        fontSize: '14px',
        lineHeight: '1.6',
      }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
Note: /health is a public route — not under _authenticated. It
must be reachable without login for uptime monitors.

Also: this route sets the HTTP status implicitly as 200 (the page
renders). For proper 200 vs 503 response codes, a Netlify Function
/api/health is more appropriate. Recommendation: add a Netlify Function
netlify/functions/health.ts that returns proper status codes, and keep
/health route for human debugging:

ts
// netlify/functions/health.ts
import type { Config } from '@netlify/functions';

export default async () => {
  const checks = await Promise.allSettled([
    // probe supabase with a lightweight query
    fetch(`${process.env.SUPABASE_URL}/rest/v1/app_config?select=key&limit=1`, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY!}`,
      },
      signal: AbortSignal.timeout(2000),
    }),
  ]);

  const supabaseOk = checks[0].status === 'fulfilled' && checks[0].value.ok;

  const payload = {
    status: supabaseOk ? 'ok' : 'degraded',
    version: process.env.npm_package_version ?? 'unknown',
    timestamp: new Date().toISOString(),
    services: { supabase: supabaseOk ? 'ok' : 'down' },
  };

  return new Response(JSON.stringify(payload), {
    status: supabaseOk ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { path: '/api/health' };
Configure UptimeRobot / Better Stack to hit /api/health every 5 minutes.

11. public/robots.txt
text
User-agent: *
Disallow: /chats
Disallow: /calls
Disallow: /communities
Disallow: /novedades
Disallow: /settings
Disallow: /profile
Disallow: /onboarding
Disallow: /api/
Allow: /
Allow: /auth/
Allow: /legal/
Allow: /health

Sitemap: https://silverchat-app.netlify.app/sitemap.xml
12. public/sitemap.xml
xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://silverchat-app.netlify.app/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://silverchat-app.netlify.app/auth/login</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://silverchat-app.netlify.app/auth/signup</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://silverchat-app.netlify.app/legal/terms</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://silverchat-app.netlify.app/legal/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
13. .env.example
bash
# ─────────────────────────────────────────────────────────
# SUPABASE (browser-safe; RLS enforces security)
# ─────────────────────────────────────────────────────────
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

# ─────────────────────────────────────────────────────────
# LIVEKIT (URL only — API key/secret stay server-side)
# ─────────────────────────────────────────────────────────
VITE_LIVEKIT_URL=wss://your-project.livekit.cloud

# ─────────────────────────────────────────────────────────
# CLOUDFLARE TURNSTILE (site key is public)
# ─────────────────────────────────────────────────────────
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAA...

# ─────────────────────────────────────────────────────────
# WEB PUSH (public key — private key is a Supabase secret)
# ─────────────────────────────────────────────────────────
VITE_VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U

# ─────────────────────────────────────────────────────────
# SENTRY (DSN is public — auth token is Netlify-only)
# ─────────────────────────────────────────────────────────
VITE_SENTRY_DSN=https://abc123@o12345.ingest.sentry.io/6789

# ─────────────────────────────────────────────────────────
# APP VERSION (auto-injected at build via vite.config.ts)
# ─────────────────────────────────────────────────────────
# VITE_APP_VERSION=silverchat@1.0.0+abc123f

# ═════════════════════════════════════════════════════════
# SERVER-SIDE ONLY (Netlify env vars + Supabase Edge secrets)
# ═════════════════════════════════════════════════════════
# NEVER prefix these with VITE_ — they must never reach the browser.
#
# Netlify build env:
#   SUPABASE_URL                (for netlify/functions)
#   SUPABASE_SERVICE_ROLE_KEY   (for admin operations in functions)
#   SUPABASE_ANON_KEY           (for function-side RLS queries)
#   ALLOWED_ORIGINS             (comma-separated, e.g. https://yourapp.netlify.app,http://localhost:8888)
#   TURNSTILE_SECRET_KEY        (Cloudflare secret)
#   SENTRY_ORG                  (Sentry org slug)
#   SENTRY_PROJECT              (Sentry project slug)
#   SENTRY_AUTH_TOKEN           (Sentry API token, uploads source maps)
#
# Supabase Edge Function secrets (supabase secrets set KEY=value):
#   LIVEKIT_API_KEY             (from LiveKit Cloud dashboard)
#   LIVEKIT_API_SECRET          (from LiveKit Cloud dashboard)
#   LIVEKIT_URL                 (wss://... same as VITE_LIVEKIT_URL)
#   VAPID_PUBLIC_KEY            (same as VITE_VAPID_PUBLIC_KEY)
#   VAPID_PRIVATE_KEY           (never exposed — used by send-push function)
14. README.md
markdown
# SilverChat

> A privacy-first messaging app with a futuristic silver aesthetic.

SilverChat is a full-featured WhatsApp alternative built as a PWA with
end-to-end privacy guarantees enforced by Postgres Row-Level Security.
Real-time messaging, voice & video calls, channels, communities, stories,
voice notes, and more — in an elegant silver + electric blue interface.

**Live demo:** https://silverchat-app.netlify.app

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript (strict), Vite 6, TanStack Router, Tailwind CSS v4 |
| Backend | Supabase (Postgres + RLS + Auth + Storage + Realtime) |
| Calls | LiveKit Cloud (WebRTC) |
| Emails | Resend (magic links) |
| Push | Web Push (VAPID) |
| Hosting | Netlify |
| Monitoring | Sentry |
| Package manager | pnpm (enforced) |

---

## Documentation

This project was built from a 16-prompt roadmap. Each prompt is stored as a
markdown spec in `.roadmap/` (or your preferred location) for reference:

| # | Section | File |
|---|---|---|
| 1 | Foundations & Backend | `01-foundations.md` |
| 2 | Stack & Project Setup | `02-stack-setup.md` |
| 3 | Design System | `03-design-system.md` |
| 4a | Data Model — Entities | `04a-data-model-entities.md` |
| 4b-1 | RLS Policies | `04b1-rls-policies.md` |
| 4b-2 | Business Logic & RPCs | `04b2-business-logic-rpc.md` |
| 5 | Authentication | `05-authentication.md` |
| 6 | Profile & Settings | `06-profile-settings.md` |
| 7 | Chats List | `07-chats-list.md` |
| 8a | Chat Layout | `08a-chat-layout-messages.md` |
| 8b | Message Actions | `08b-message-actions.md` |
| 9 | Contact & Chat Settings | `09-contact-profile-chat-settings.md` |
| 10 | Novedades (Stories + Channels) | `10-novedades-stories-channels.md` |
| 11 | Communities | `11-communities.md` |
| 12 | Calls | `12-calls.md` |
| 13 | PWA & Offline | `13-pwa-offline.md` |
| 14 | i18n & Theme | `14-i18n-theme.md` |
| 15 | Privacy & Security | `15-privacy-security.md` |
| 16 | Deployment & Metadata | `16-deployment-metadata.md` |

Fase 2 items are tracked in [`docs/FASE-2.md`](./docs/FASE-2.md).

---

## Prerequisites

- **Node.js 20+**
- **pnpm 9+** (`npm install -g pnpm`)
- **Supabase CLI** (`npm install -g supabase`)
- Accounts (all free tier):
  - [Supabase](https://supabase.com)
  - [LiveKit Cloud](https://livekit.io)
  - [Resend](https://resend.com)
  - [Cloudflare](https://cloudflare.com) (Turnstile)
  - [Sentry](https://sentry.io)
  - [Netlify](https://netlify.com)

---

## Local setup

```bash
# 1. Clone
git clone https://github.com/JordiDevMX/silverchat-2.git
cd silverchat-2

# 2. Install dependencies (pnpm is enforced)
pnpm install

# 3. Configure environment
cp .env.example .env.local
# Fill in the VITE_* variables with your Supabase project credentials

# 4. Apply database migrations
supabase link --project-ref <your-project-ref>
supabase db push

# 5. Deploy Edge Functions
supabase functions deploy livekit-token
supabase functions deploy send-push
supabase secrets set LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... LIVEKIT_URL=wss://...
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...

# 6. Run dev server
pnpm dev
Open http://localhost:5173.

Note: magic links and push notifications won't work on localhost unless
you expose a public tunnel (e.g. ngrok http 5173) and configure the tunnel
URL in Supabase Auth → URL Configuration → Redirect URLs.

Commands
bash
pnpm dev          # start Vite dev server
pnpm build        # production build
pnpm preview      # preview production build
pnpm typecheck    # TypeScript strict check
pnpm lint         # Biome lint + format check
pnpm lint:fix     # Biome auto-fix
pnpm db:types     # regenerate src/types/database.ts from live schema
Deployment
See docs/DEPLOY.md for the complete step-by-step guide.

TL;DR:

Push to main → GitHub Actions runs CI

Netlify auto-deploys on green CI

Supabase migrations are manual (supabase db push)

Database backups (manual)
Supabase free tier does not include automated backups. While the app
has few users, take a manual backup before every schema change:

bash
# Dump schema + data (in the format Supabase uses internally)
pg_dump \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --schema=public \
  --schema=auth \
  --dbname="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  > backup-$(date +%Y%m%d-%H%M%S).sql
Store backups in an encrypted location. Retain the last 3.

Restore with:

bash
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  < backup-20250115-120000.sql
When scaling past a few hundred users, upgrade to Supabase Pro for automated
daily backups.

Security
Row-Level Security is enabled on all 21 tables — every read/write is
policy-checked server-side.

Privacy-first defaults: read receipts are fair-trade (bidirectional),
story visibility is per-user, presence is opt-in.

Session security: refresh token in httpOnly cookie, access token in
memory only. XSS cannot exfiltrate sessions.

E2E encryption: not implemented in MVP. Messages are encrypted at
rest (Supabase) and in transit (TLS), but the server can read them. If you
need true E2E, see docs/FASE-2.md.

2FA: TOTP + backup codes. Recovery requires email access.

License
Personal project. Not open-source (yet).

Contact
Built by @JordiDevMX.

text

---

## 15. `docs/DEPLOY.md`

```markdown
# Deployment guide — SilverChat

Complete step-by-step guide to deploy SilverChat to production.

Estimated time: **45–60 minutes** (first deploy).

---

## 0. Prerequisites

- Local repo cloned and `pnpm install` runs successfully
- Supabase project created (free tier)
- Netlify account
- GitHub repo with the code pushed to `main`

---

## 1. Supabase — backend setup

### 1.1 Apply migrations

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
This applies all 14 migrations in order:

0001_initial_schema.sql

0002_rls_policies.sql

0003_business_logic.sql

0004_auth_backup_codes.sql

0005_profile_settings.sql

0006_account_deletion_rpcs.sql

0007_chat_delete_adjustments.sql

0008_messages_enhancements.sql

0009_message_actions.sql

0010_chat_settings.sql

0011_stories_channels.sql

0012_communities.sql

0013_calls_enhancements.sql

0014_push_triggers.sql

1.2 Enable extensions
In the Supabase SQL editor:

sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
1.3 Configure database settings for push triggers
sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://<PROJECT_REF>.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = '<SERVICE_ROLE_KEY>';
Replace placeholders. SERVICE_ROLE_KEY is in Supabase → Settings → API.

1.4 Deploy Edge Functions
bash
supabase functions deploy livekit-token --no-verify-jwt=false
supabase functions deploy send-push --no-verify-jwt=false
Set secrets:

bash
supabase secrets set LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... LIVEKIT_URL=wss://...
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...
1.5 Configure Auth
Supabase Dashboard → Authentication → URL Configuration:

Site URL: https://silverchat-app.netlify.app

Redirect URLs (add all):

https://silverchat-app.netlify.app/api/auth/callback

http://localhost:5173/api/auth/callback (dev)

http://localhost:8888/api/auth/callback (netlify dev)

1.6 Configure SMTP (Resend)
Supabase Dashboard → Authentication → SMTP Settings:

Host: smtp.resend.com

Port: 587

User: resend

Password: <RESEND_API_KEY>

Sender email: noreply@yourdomain.com

Sender name: SilverChat

1.7 Create Storage buckets
Supabase Dashboard → Storage → New bucket (all private):

avatars

chat-media

story-media

channel-media

Bucket policies are created by migration 0002.

2. LiveKit Cloud
Sign up at https://livekit.io

Create project

Copy API Key, API Secret, WebSocket URL (wss://...)

Paste into Supabase secrets (step 1.4)

3. Cloudflare Turnstile
Cloudflare Dashboard → Turnstile → Add site

Add domain: silverchat-app.netlify.app (and localhost for dev)

Copy Site Key (public, goes to .env.local as VITE_TURNSTILE_SITE_KEY)

Copy Secret Key (goes to Netlify env as TURNSTILE_SECRET_KEY)

4. Sentry
Sign up at https://sentry.io

Create project (React)

Copy DSN → VITE_SENTRY_DSN

Create auth token: Settings → Auth Tokens → Create

Copy Auth Token, Org, Project slug → Netlify env

5. Resend (magic link emails)
Sign up at https://resend.com

Add domain (or use onboarding@resend.dev for MVP)

Copy API Key → Supabase SMTP config (step 1.6)

6. Netlify — deploy
6.1 Connect repo
Netlify Dashboard → Add new site → Import existing project

Select your GitHub repo

Build settings (auto-detected):

Build command: pnpm build

Publish directory: dist

Functions directory: netlify/functions

6.2 Configure environment variables
Netlify → Site settings → Environment variables:

Build-time (public):

text
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<ANON_KEY>
VITE_LIVEKIT_URL=wss://<SUBDOMAIN>.livekit.cloud
VITE_TURNSTILE_SITE_KEY=<TURNSTILE_SITE_KEY>
VITE_VAPID_PUBLIC_KEY=<VAPID_PUBLIC_KEY>
VITE_SENTRY_DSN=<SENTRY_DSN>
Build-time (server-only, for source map upload):

text
SENTRY_ORG=<SENTRY_ORG_SLUG>
SENTRY_PROJECT=<SENTRY_PROJECT_SLUG>
SENTRY_AUTH_TOKEN=<SENTRY_AUTH_TOKEN>
Runtime (for Netlify Functions):

text
SUPABASE_URL=https://<PROJECT_REF>.supabase.co
SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
ALLOWED_ORIGINS=https://silverchat-app.netlify.app,http://localhost:8888
TURNSTILE_SECRET_KEY=<TURNSTILE_SECRET_KEY>
6.3 Deploy
Push to main. Netlify builds and deploys automatically.

First deploy URL will be something like
https://random-name-123.netlify.app. Rename it:
Site settings → Change site name → silverchat-app.

Update .env / Netlify env vars with the final URL and update Supabase
Auth redirect URLs accordingly.

7. Uptime monitoring
Sign up at https://uptimerobot.com (free)

Add monitor: https://silverchat-app.netlify.app/api/health

Check every 5 minutes

Alert email on 3 consecutive failures

8. GitHub Actions secrets
GitHub repo → Settings → Secrets and variables → Actions:

Add same public secrets as Netlify build-time (VITE_*), plus
SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT.

9. Post-deploy verification
Run through this checklist:

□ Landing page loads: https://silverchat-app.netlify.app/
□ /health returns { status: 'ok' }
□ /api/health returns 200 with JSON
□ Signup flow works (magic link email arrives)
□ Onboarding completes (username pick)
□ Chat with yourself works (send a message)
□ Send a message to a second account (from another browser) → realtime
□ Install PWA on mobile → opens standalone
□ Notification permission prompt appears → grant → devices row updated
□ Push notification arrives when app is closed
□ Call between two browsers (voice) → connects
□ Video call → both cameras appear
□ 2FA enrollment works → QR scans → code verifies
□ Sentry receives a test error (DevTools: throw new Error('test'))
□ OG card renders in WhatsApp / Twitter / LinkedIn link previews
□ robots.txt blocks /chats (view source)
10. Rolling back
If a deploy breaks production:

Netlify: Site → Deploys → click any previous deploy → "Publish deploy".

Supabase: migrations are forward-only. Roll back by writing a new
migration that reverses the change.

11. Updating the app
bash
git push origin main       # triggers CI + auto-deploy
For DB changes:

bash
# 1. Create migration locally
supabase migration new my_change
# 2. Edit the SQL file
# 3. Test locally
supabase db reset
# 4. Push to prod
supabase db push
# 5. Regenerate types
pnpm db:types
⚠️ Never edit schema directly in the Supabase dashboard. Always through
migrations.

text

---

## 16. `docs/FASE-2.md`

```markdown
# Fase 2 — Deferred features

Items explicitly deferred during MVP development. Sorted by section.

## Calls (Prompt 12)
- Group calls
- Screen sharing
- Call recording
- Call quality indicators
- Push notification for calls when tab closed (partially solved in #13 via push)
- Call waiting
- Voicemail / missed call transcripts
- Call forwarding
- Video background blur / virtual backgrounds
- Front/back camera switch
- "Minimize call" PiP outside app
- Call history pagination (>100)
- Contact search in FAB (only active chats currently)

## Novedades (Prompt 10)
- Story text overlays / stickers / drawing
- Story filters / AR
- Story emoji reactions
- Story archive / highlights
- Global channel search
- Channel comments / discussion threads
- Channel verification UI (SQL only for now)
- Channel analytics
- Channel invite links
- Push notifications for stories/channels
- Videos > 15s per story segment

## Communities (Prompt 11)
- Discovery / public communities
- Invite links
- Bulk add members
- Community-level roles beyond admin/member
- Custom chat ordering / categories
- Voice channels
- Threads within chats
- Emoji reactions on community cards
- Community analytics

## Chat (Prompts 7, 8a, 8b, 9)
- Server-side full-text search (local only for now)
- Virtualization (react-virtuoso) for huge message lists
- Pinch-to-zoom in lightbox
- Multi-file selection per message
- Message translation
- Scheduled messages
- Edit history viewer
- Rich reactions tooltip with avatars
- Typing indicators
- Sticker picker / catalog
- Message info screen
- Multi-message copy
- Group avatar composite (initials of members)
- Mute-by-user within a group
- Member search within members list
- Group invite links
- Shared links tab in media view
- Link OG previews (URLs render as plain links)

## Auth (Prompt 5)
- Password authentication
- Social login (Google, Apple — explicitly forbidden by original spec)
- Phone auth (explicitly forbidden)
- Biometric auth (explicitly forbidden)
- Live username availability check (submit-only)
- Custom email templates via Resend
- One-time exchange codes for callback (accepted 100ms URL exposure)
- Dedicated MFA-complete endpoint (using refresh workaround)
- Rate limiting via Redis (using Supabase defaults + memory cache)

## Privacy & Security (Prompt 15)
- Session timeout
- New-device email alerts
- GDPR data export
- Login history
- App lock / PIN / biometrics / passkeys — **explicitly out of scope**
- Per-device sign-out — **explicitly out of scope**
- Trusted devices marking
- IP allowlist
- Audit log UI
- End-to-end encryption (post-MVP architectural decision)

## PWA & Offline (Prompt 13)
- Background Sync API
- Periodic Background Sync
- Offline media upload queue (only text in outbox)
- Rich push notification actions
- Silent push / data-only push
- Push subscription sync on device sign-out

## Profile & Settings (Prompt 6)
- Multi-account switching
- Web Push "enabled" state per device in UI (currently auto)
- Manual backup codes regeneration once used
- Profile photo view count / reactions

## i18n & Theme (Prompt 14)
- Additional languages beyond `en` + `es`
- RTL support
- Date/time format customization per user
- Font size preferences

## Deployment (Prompt 16)
- Custom domain + Cloudflare
- Analytics (Umami / Plausible)
- Automated backups (Supabase Pro)
- Sentry for Netlify Functions / Edge Functions
- Blue/green deploy strategy
- Preview environments for PRs
17. WHAT NOT TO INCLUDE IN THIS PROMPT
❌ Custom domain setup (Fase 2)

❌ Cloudflare in front of Netlify (Fase 2)

❌ Analytics integration (Fase 2)

❌ Automated DB backups (Fase 2)

❌ Preview environments per PR (Fase 2)

❌ Blue/green deploys (Fase 2)

❌ Sentry backend integration (Fase 2 — frontend only for MVP)

❌ Legal pages (/legal/terms, /legal/privacy — placeholder routes only)

❌ Custom 404 page (default Netlify is fine for MVP)

❌ Custom email templates (using Supabase default)

18. HOW TO RESPOND
Respond in this exact order:

One-paragraph confirmation listing: Sentry integration (client + build
plugin), GitHub Actions CI workflow, netlify.toml with security headers,
_redirects, complete OG meta tags in index.html, /health route +
/api/health function, robots.txt, sitemap.xml, .env.example,
README.md, docs/DEPLOY.md, docs/FASE-2.md.

Complete file tree of new/modified files.

Complete content of every file:

.github/workflows/ci.yml

netlify.toml

public/_redirects

public/robots.txt

public/sitemap.xml

index.html (complete with all meta tags)

src/lib/sentry.ts

src/routes/health.tsx

netlify/functions/health.ts

vite.config.ts (modified — Sentry plugin + version define)

src/app/main.tsx (modified — initSentry + init order)

src/app/App.tsx (modified — Error Boundary)

src/lib/auth-provider.tsx (modified — Sentry.setUser on login/logout)

.env.example (complete)

README.md (complete)

docs/DEPLOY.md (complete)

docs/FASE-2.md (complete)

Assets checklist (files the developer must provide manually):

public/og-image.png (1200×630)

public/icons/icon-180.png

public/icons/icon-192.png

public/icons/icon-512.png

public/icons/icon-512-maskable.png

public/favicon.ico

public/sounds/ringtone.mp3

public/sounds/calling.mp3

For each, provide a short recommendation on where to source/generate
(e.g., "use pwa-asset-generator for icons", "use
https://realfavicongenerator.net/ for favicon", "og-image.png: design
in Figma with the brand colors", "sounds: mixkit.co CC0").

Environment variables checklist (final):

Local .env.local

Netlify build-time (VITE_*)

Netlify runtime (server-only)

Supabase Edge Function secrets

GitHub Actions secrets

Verification checklist (go-live):

Push to main → CI green → Netlify auto-deploys

Bad PR (e.g. TS error) → CI red → Netlify refuses deploy

/health returns 200 with JSON

/api/health returns 200 with JSON

/robots.txt disallows /chats, /settings, etc.

/sitemap.xml lists only public routes

index.html includes OG + Twitter Card + JSON-LD

Share https://<site>.netlify.app/ in WhatsApp → preview card renders

Share on Twitter → Twitter card renders

Trigger an error (throw new Error('test') in DevTools) → Sentry
receives it within 30s

Sentry does NOT capture PII (check payload — no message content, no
email)

Lighthouse PWA check passes

Security headers present (check with https://securityheaders.com)

CSP blocks inline script not in allowlist (test with a <script>
injected manually via DevTools)

A short list of pitfalls to warn the developer:

Why SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT are build-time
only (they upload source maps during build; never reach client)

Why sourcemap: true in Vite + Sentry plugin is safe (maps uploaded to
Sentry, not served to browsers)

Why CSP must include https://challenges.cloudflare.com (Turnstile) and
https://*.livekit.io (WebRTC signaling)

Why frame-ancestors 'none' in CSP + X-Frame-Options: DENY (both,
belt-and-suspenders — older browsers use X-Frame-Options, newer use CSP)

Why Service-Worker-Allowed: / header on /sw.js (allows the SW to
control the entire scope)

Why /health route (SPA route) and /api/health function coexist
(route for humans, function for uptime monitors with proper status
codes)

Why migrations are manual (supabase db push) not automated
(prevents accidental DROP TABLE on prod)

Why robots.txt blocks app routes (auth-only app — indexing chat URLs
would 401 anyway, but blocking avoids bots hammering)

Why docs/FASE-2.md exists (keeps every deferred item visible — no
silent scope creep)

Why backup commands are documented instead of scripted (manual forces
the developer to think before restoring; automated backups come with
Supabase Pro)

Why beforeSend filters tokens in URLs (magic link callbacks include
?access_token= — must never reach Sentry)

Why maskAllText: true and blockAllMedia: true in Replay
(privacy-first — no user content captured)

Why tracesSampleRate: 0.1 (5k events/month free tier — 100% would
burn quota in days)

Why the /api/health function returns 503 on degraded (uptime monitors
need non-200 to trigger alerts)

This is the last prompt of the roadmap. Do not implement Fase 2 items.
Do not add analytics. Do not add custom domain setup. Ship the MVP.
````
