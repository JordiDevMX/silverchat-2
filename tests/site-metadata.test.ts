import assert from "node:assert/strict";
import test from "node:test";
import {
  DISALLOWED_PREFIXES,
  OG_IMAGE_URL,
  ORIGIN,
  PUBLIC_ROUTES,
  renderRobotsTxt,
  renderSeoBlock,
  renderSitemapXml,
  routeUrl,
} from "../scripts/site-metadata.ts";

test("every public route has a unique title and description", () => {
  const titles = new Set(PUBLIC_ROUTES.map((route) => route.title));
  const descriptions = new Set(PUBLIC_ROUTES.map((route) => route.description));
  assert.equal(titles.size, PUBLIC_ROUTES.length);
  assert.equal(descriptions.size, PUBLIC_ROUTES.length);
});

test("every public route is reachable without a session", () => {
  const paths = PUBLIC_ROUTES.map((route) => route.path);
  assert.deepEqual(paths, ["/", "/auth/login", "/auth/signup"]);
});

test("no authenticated route is listed as public", () => {
  for (const prefix of DISALLOWED_PREFIXES) {
    for (const route of PUBLIC_ROUTES) {
      assert.ok(
        !route.path.startsWith(prefix),
        `${route.path} must not be a public route (${prefix} is disallowed)`,
      );
    }
  }
});

test("the canonical URL of a route is absolute and unique", () => {
  const urls = PUBLIC_ROUTES.map((route) => routeUrl(route.path));
  assert.equal(new Set(urls).size, PUBLIC_ROUTES.length);
  for (const url of urls) {
    assert.ok(url.startsWith(ORIGIN), `${url} must be absolute`);
  }
  assert.equal(routeUrl("/"), `${ORIGIN}/`);
  assert.equal(routeUrl("/auth/login"), `${ORIGIN}/auth/login`);
});

test("the SEO block carries the metadata a scraper reads", () => {
  const block = renderSeoBlock(PUBLIC_ROUTES[0]);
  assert.match(block, /<title>SilverChat — Privacy-first messaging<\/title>/);
  assert.match(block, /<meta name="description" content="[^"]+"/);
  assert.match(block, new RegExp(`<link rel="canonical" href="${ORIGIN}/" />`));
  assert.match(block, /<meta property="og:type" content="website" \/>/);
  assert.match(block, /<meta property="og:site_name" content="SilverChat" \/>/);
  assert.match(block, new RegExp(`<meta property="og:image" content="${OG_IMAGE_URL}" \\/>`));
  assert.match(block, /<meta name="twitter:card" content="summary_large_image" \/>/);
  assert.match(block, /<meta property="og:image:width" content="1200" \/>/);
  assert.match(block, /<meta property="og:image:height" content="630" \/>/);
  assert.match(block, /<script type="application\/ld\+json">/);
});

test("the structured data is valid JSON that names the app", () => {
  const block = renderSeoBlock(PUBLIC_ROUTES[1]);
  const json = block.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n {4}<\/script>/);
  assert.ok(json, "the SEO block must contain a JSON-LD script");
  const parsed = JSON.parse(json[1] ?? "") as Record<string, unknown>;
  assert.equal(parsed["@context"], "https://schema.org");
  assert.equal(parsed["@type"], "WebApplication");
  assert.equal(parsed["name"], "SilverChat");
  assert.equal(parsed["url"], `${ORIGIN}/auth/login`);
});

test("robots.txt allows the public routes and blocks the app", () => {
  const robots = renderRobotsTxt();
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Allow: \/auth\/$/m);
  for (const prefix of DISALLOWED_PREFIXES) {
    assert.ok(robots.includes(`Disallow: ${prefix}`), `missing Disallow: ${prefix}`);
  }
  assert.ok(robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`));
});

test("the sitemap lists exactly the public routes", () => {
  const sitemap = renderSitemapXml();
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(
    locations,
    PUBLIC_ROUTES.map((route) => routeUrl(route.path)),
  );
});
