import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import {
  PUBLIC_ROUTES,
  type PublicRoute,
  renderRobotsTxt,
  renderSeoBlock,
  renderSitemapXml,
} from "./site-metadata.ts";

/**
 * Vite plugin that owns the SEO surface of the build.
 *
 * It does two things:
 *
 *  1. Injects the head block into index.html. The markup lives in
 *     scripts/site-metadata.ts, so the canonical URL, the Open Graph card and
 *     the Twitter card can never drift apart from the sitemap.
 *
 *  2. Prerenders the public routes. SilverChat is a client-rendered SPA, so
 *     without this every URL (/, /auth/login, /auth/signup) would serve the
 *     same <title> and the same canonical URL, which tells a crawler that
 *     they are duplicates of each other. Emitting one HTML file per public
 *     route gives each one its own title, description and canonical URL,
 *     which is what a search result and a link preview actually read.
 *
 * The prerendered files reuse the exact same script tag and asset references
 * as index.html: the client bundle boots once and takes over, so routing
 * behaviour is unchanged.
 */

const SEO_START = "<!-- seo:start -->";
const SEO_END = "<!-- seo:end -->";

/**
 * Replaces the head block of an HTML document with the one for a route.
 *
 * The block is delimited by sentinel comments so the substitution is precise
 * and cannot touch the rest of the document.
 */
export function applyRouteHead(html: string, route: PublicRoute): string {
  const start = html.indexOf(SEO_START);
  const end = html.indexOf(SEO_END);
  if (start === -1 || end === -1) {
    throw new Error("SEO sentinels missing from the HTML document");
  }

  const before = html.slice(0, start + SEO_START.length);
  const after = html.slice(end);
  return `${before}\n${renderSeoBlock(route)}\n  ${after}`;
}

export function seoPlugin(): Plugin {
  let outDir = "dist";
  let isBuild = false;

  return {
    name: "silverchat-seo",
    configResolved(config) {
      outDir = config.build.outDir;
      isBuild = config.command === "build";
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return applyRouteHead(html, PUBLIC_ROUTES[0]);
      },
    },
    closeBundle() {
      // The dev server has no bundle to write into: it serves the metadata
      // through transformIndexHtml and serves every route from index.html.
      if (!isBuild) return;

      const outPath = path.resolve(outDir);
      const indexPath = path.join(outPath, "index.html");
      if (!existsSync(indexPath)) {
        throw new Error(`Expected ${indexPath} to exist after the build`);
      }
      const indexHtml = readFileSync(indexPath, "utf8");

      // One HTML file per public route, so each URL has its own metadata.
      for (const route of PUBLIC_ROUTES) {
        if (route.path === "/") continue;
        const routePath = path.join(outPath, route.path.replace(/^\//, ""), "index.html");
        mkdirSync(path.dirname(routePath), { recursive: true });
        writeFileSync(routePath, applyRouteHead(indexHtml, route), "utf8");
      }

      // robots.txt and sitemap.xml are derived from the same source of truth.
      writeFileSync(path.join(outPath, "robots.txt"), renderRobotsTxt(), "utf8");
      writeFileSync(path.join(outPath, "sitemap.xml"), renderSitemapXml(), "utf8");
    },
  };
}
