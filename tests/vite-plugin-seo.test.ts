import assert from "node:assert/strict";
import test from "node:test";
import { ORIGIN, PUBLIC_ROUTES } from "../scripts/site-metadata.ts";
import { applyRouteHead } from "../scripts/vite-plugin-seo.ts";

const document = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <!-- seo:start -->
    <!-- seo:end -->
    <link rel="icon" href="/favicon.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/app/main.tsx"></script>
  </body>
</html>
`;

test("the route head replaces the sentinel block and nothing else", () => {
  const result = applyRouteHead(document, PUBLIC_ROUTES[0]);
  assert.match(result, /<title>SilverChat — Privacy-first messaging<\/title>/);
  assert.match(result, new RegExp(`<link rel="canonical" href="${ORIGIN}/" />`));
  // Everything outside the sentinels survives untouched.
  assert.match(result, /<meta charset="UTF-8" \/>/);
  assert.match(result, /<link rel="icon" href="\/favicon\.svg" \/>/);
  assert.match(result, /<script type="module" src="\/src\/app\/main\.tsx"><\/script>/);
  assert.equal(result.match(/<!-- seo:start -->/g)?.length, 1);
  assert.equal(result.match(/<!-- seo:end -->/g)?.length, 1);
});

test("each prerendered route gets its own title and canonical URL", () => {
  const titles = new Set<string>();
  const canonicals = new Set<string>();

  for (const route of PUBLIC_ROUTES) {
    const result = applyRouteHead(document, route);
    const title = result.match(/<title>([^<]+)<\/title>/)?.[1];
    const canonical = result.match(/<link rel="canonical" href="([^"]+)" \/>/)?.[1];
    const ogUrl = result.match(/<meta property="og:url" content="([^"]+)" \/>/)?.[1];

    assert.equal(title, route.title);
    assert.equal(canonical, `${ORIGIN}${route.path === "/" ? "/" : route.path}`);
    assert.equal(ogUrl, canonical);
    titles.add(title ?? "");
    canonicals.add(canonical ?? "");
  }

  assert.equal(titles.size, PUBLIC_ROUTES.length);
  assert.equal(canonicals.size, PUBLIC_ROUTES.length);
});

test("a document without the sentinels is rejected instead of silently mangled", () => {
  assert.throws(
    () => applyRouteHead("<html><head></head></html>", PUBLIC_ROUTES[0]),
    /SEO sentinels missing/,
  );
});
