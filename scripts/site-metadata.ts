/**
 * Single source of truth for the public site metadata.
 *
 * Every consumer of the production origin reads it from here:
 *   - scripts/vite-plugin-seo.ts -> injects the head tags at build time,
 *     prerenders the public routes and writes robots.txt / sitemap.xml.
 *
 * The origin is baked into build output on purpose: crawlers and social
 * scrapers need absolute URLs, and they never run the Netlify Functions
 * environment where SITE_URL lives. When the production domain changes, edit
 * ORIGIN here and rebuild — nothing else has to change.
 */
export const ORIGIN = "https://silverchat-app.netlify.app";

export const SITE_NAME = "SilverChat";

export const SITE_TAGLINE = "Privacy-first messaging";

/**
 * Landing description, shared by the SERP snippet, Open Graph and the
 * structured data. Social previews trim it at ~158 characters on desktop
 * (~3 mobile lines), so it must stay well below that.
 */
export const SITE_DESCRIPTION =
  "Privacy-first messaging for the conversations that matter. Real-time chats, stories, communities, and voice & video calls.";

export type PublicRoute = {
  /** Route path, always starting with a slash. */
  path: string;
  /** <title> and og:title for the route. */
  title: string;
  /** <meta name="description"> and og:description for the route. */
  description: string;
  /** Sitemap hint. */
  changefreq: "daily" | "weekly" | "monthly";
  /** Sitemap hint. */
  priority: string;
};

/**
 * The routes that are public, indexable and reachable without a session.
 *
 * Everything else in the app (chats, channels, communities, settings, profiles)
 * requires authentication and is excluded from both the sitemap and the
 * robots allow list, so it must not be listed here.
 *
 * Declared as a const tuple so PUBLIC_ROUTES[0] is known to be the root route
 * under noUncheckedIndexedAccess.
 */
export const PUBLIC_ROUTES = [
  {
    path: "/",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    changefreq: "weekly",
    priority: "1.0",
  },
  {
    path: "/auth/login",
    title: `Log in — ${SITE_NAME}`,
    description:
      "Sign in to SilverChat with your email. No password needed — we send you a secure magic link.",
    changefreq: "monthly",
    priority: "0.8",
  },
  {
    path: "/auth/signup",
    title: `Create your account — ${SITE_NAME}`,
    description:
      "Create your SilverChat account with your email. Privacy-first messaging for the conversations that matter.",
    changefreq: "monthly",
    priority: "0.8",
  },
] as const satisfies readonly PublicRoute[];

/**
 * Path prefixes that must never be indexed: they are either authenticated
 * views or private API endpoints.
 */
export const DISALLOWED_PREFIXES = [
  "/chats",
  "/channels",
  "/communities",
  "/novedades",
  "/calls",
  "/settings",
  "/profile",
  "/onboarding",
  "/api/",
];

export const OG_IMAGE_PATH = "/og-image.png";

/** Absolute URL of the social card. */
export const OG_IMAGE_URL = `${ORIGIN}${OG_IMAGE_PATH}`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Absolute, canonical URL of a route. */
export function routeUrl(path: string): string {
  return path === "/" ? `${ORIGIN}/` : `${ORIGIN}${path}`;
}

/**
 * The head block for a route: title, description, canonical URL, Open Graph,
 * Twitter Card and the JSON-LD structured data.
 *
 * Everything here depends on the route or on the origin, so it is generated
 * rather than written by hand. The markers delimit the block so the build can
 * replace it when prerendering another route.
 */
export function renderSeoBlock(route: PublicRoute): string {
  const url = routeUrl(route.path);
  const title = escapeHtml(route.title);
  const description = escapeHtml(route.description);

  const jsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE_NAME,
      url,
      description: route.description,
      applicationCategory: "SocialNetworkingApplication",
      operatingSystem: "Any",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      inLanguage: ["en", "es"],
    },
    null,
    2,
  );

  return `    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${url}" />

    <!-- Open Graph (Facebook, LinkedIn, WhatsApp, Telegram) -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${OG_IMAGE_URL}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/png" />
    <meta
      property="og:image:alt"
      content="The SilverChat logo: a silver S on an electric-blue circle, next to the SilverChat wordmark."
    />
    <meta property="og:locale" content="en_US" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${url}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${OG_IMAGE_URL}" />
    <meta
      name="twitter:image:alt"
      content="The SilverChat logo and wordmark on a silver and electric-blue background."
    />

    <!-- Structured data -->
    <script type="application/ld+json">
${jsonLd}
    </script>`;
}

/** robots.txt content: only the public routes stay crawlable. */
export function renderRobotsTxt(): string {
  const lines = [
    "# https://www.robotstxt.org/robotstxt.html",
    "#",
    "# SilverChat is an authenticated messaging app: only the landing and the auth",
    "# entry points are worth indexing. Every other route needs a session and",
    "# renders the same shell, so it is disallowed to avoid duplicate content.",
    "",
    "User-agent: *",
    "Allow: /",
    "Allow: /auth/",
    "",
    ...DISALLOWED_PREFIXES.map((prefix) => `Disallow: ${prefix}`),
    "",
    `Sitemap: ${ORIGIN}/sitemap.xml`,
    "",
  ];
  return lines.join("\n");
}

/** sitemap.xml content: the public routes only. */
export function renderSitemapXml(): string {
  const entries = PUBLIC_ROUTES.map(
    (route) => `  <url>
    <loc>${routeUrl(route.path)}</loc>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`,
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}
