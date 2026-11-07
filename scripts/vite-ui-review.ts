import type { Plugin } from "vite";

const fixture = "/tests/ui-foundation.html";
const appGuide = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="/favicon.svg"><title>SilverChat UI review server</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:44rem;margin:12vh auto;padding:1.5rem;color:#e6edf3;background:#101820}a{color:#62cfff}code{font-size:1em}</style></head>
<body><main><h1>This is the UI review server</h1>
<p>Review the shared UI, conversations, communities, stories, broadcast channels, settings and auth/onboarding samples without signing in.</p>
<p><a href="${fixture}">Open the SilverChat review fixture</a></p>
<p>Live chats, communities, stories, channels, settings and public profiles require the app's auth backend and a real session. Plain Vite does not serve <code>/api/auth/*</code>. This server does not bypass authentication or create a mock account.</p>
<p>See <code>docs/ui-feedback-review.md</code> for the separate application setup.</p></main></body></html>`;

/** Development-only routing/discovery; production routes and auth guards are untouched. */
export function uiReviewLinks(reviewOnly: boolean): Plugin {
  return {
    name: "silverchat-ui-review-links",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        if (request.method !== "GET" && request.method !== "HEAD") return next();
        if (
          pathname === "/ui-foundation.html" ||
          pathname === "/ui-review" ||
          (reviewOnly && pathname === "/")
        ) {
          response.writeHead(302, { Location: fixture, "Cache-Control": "no-store" });
          response.end();
          return;
        }
        if (
          reviewOnly &&
          /^\/(chats|communities|novedades|channels|settings|profile|auth|onboarding|calls)(\/|$)/.test(
            pathname,
          )
        ) {
          response.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          });
          response.end(request.method === "HEAD" ? undefined : appGuide);
          return;
        }
        next();
      });
      const printUrls = server.printUrls.bind(server);
      server.printUrls = () => {
        printUrls();
        const origin = server.resolvedUrls?.local[0];
        if (!origin) return;
        server.config.logger.info(
          `\n  UI review (no login): ${origin.replace(/\/$/, "")}${fixture}`,
        );
        server.config.logger.info(
          reviewOnly
            ? "  Review-only server: / opens the fixture. No .env files or auth backend required."
            : "  App frontend only: / is the existing public/auth entry. Live app login needs the Netlify auth backend.\n  For isolated visual review, run: pnpm review:ui",
        );
      };
    },
  };
}
