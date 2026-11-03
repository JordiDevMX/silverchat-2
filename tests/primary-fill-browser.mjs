import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
});
const origin = process.env.UI_REVIEW_URL ?? "http://127.0.0.1:5177";
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.goto(`${origin}/tests/ui-foundation.html`);
  await page.getByRole("button", { name: "Follow", exact: true }).waitFor();
  const measurements = [];
  for (const mode of ["light", "dark"]) {
    const gradients = new Set();
    for (const accent of ["blue", "orange", "green", "purple", "red", "yellow"]) {
      await page.evaluate(
        ({ mode, accent }) => {
          document.documentElement.dataset.theme = mode;
          document.documentElement.className = `theme-${accent}`;
        },
        { mode, accent },
      );
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime))
            .map((a) => a.finished.catch(() => {})),
        ),
      );
      const samples = await page.evaluate(() => {
        const probe = document.createElement("span");
        probe.style.transition = "none";
        document.body.append(probe);
        const rgb = (color) => {
          probe.style.color = `color(from ${color} srgb r g b)`;
          const computed = getComputedStyle(probe).color;
          if (!computed.startsWith("color(srgb") && !computed.startsWith("rgb"))
            throw new Error(`Unexpected color ${color}: ${probe.style.color} => ${computed}`);
          const srgb = computed.match(/color\(srgb ([^)]+)\)/);
          const values = srgb
            ? srgb[1].split(" ").slice(0, 3).map(Number)
            : computed
                .match(/[\d.]+/g)
                .slice(0, 3)
                .map((v) => Number(v) / 255);
          return values.map((v) => Math.max(0, Math.min(1, v)));
        };
        const luminance = (color) =>
          rgb(color)
            .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
            .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const result = [];
        for (const [kind, selector] of [
          ["brand", '[data-slot="brand-mark"]'],
          ["fab", '[data-slot="floating-action-button"]'],
          ["badge", '[aria-label="12 unread messages"]'],
          ["switch", '[aria-label="Glow enabled"]'],
          ["nav", '[data-slot="active-nav-preview"]'],
        ]) {
          for (const el of document.querySelectorAll(selector)) {
            const style = getComputedStyle(el),
              gradient = style.backgroundImage;
            const foreground =
              kind === "switch"
                ? getComputedStyle(el.firstElementChild).backgroundColor
                : style.color;
            const stops = gradient.match(/oklch\([^)]+\)|oklab\([^)]+\)/g);
            let contrast = Infinity;
            if (stops?.length === 2)
              for (let i = 0; i <= 20; i++) {
                const background = luminance(
                    `color-mix(in oklab,${stops[0]} ${i * 5}%,${stops[1]})`,
                  ),
                  fg = luminance(foreground);
                contrast = Math.min(
                  contrast,
                  (Math.max(background, fg) + 0.05) / (Math.min(background, fg) + 0.05),
                );
              }
            result.push({ kind, gradient, foreground: rgb(foreground), contrast });
          }
        }
        probe.remove();
        return result;
      });
      assert.equal(samples.filter((s) => s.kind === "fab").length, 4);
      for (const sample of samples) {
        assert.match(sample.gradient, /linear-gradient/);
        assert.ok(Number.isFinite(sample.contrast));
        if (mode === "light" || sample.kind === "brand")
          assert.deepEqual(sample.foreground, [1, 1, 1]);
        else
          assert.ok(
            sample.foreground.every((channel) => channel < 0.1),
            `${mode}/${accent}/${sample.kind}: ${sample.foreground}`,
          );
        if (sample.kind !== "brand")
          assert.ok(
            sample.contrast >= (sample.kind === "badge" ? 4.5 : 3),
            `${mode}/${accent}/${sample.kind}: ${sample.contrast.toFixed(2)} contrast`,
          );
      }
      gradients.add(samples.find((s) => s.kind === "brand").gradient);
      measurements.push({
        mode,
        accent,
        icon: +Math.min(
          ...samples
            .filter((s) => ["fab", "nav", "switch"].includes(s.kind))
            .map((s) => s.contrast),
        ).toFixed(2),
        badge: +samples.find((s) => s.kind === "badge").contrast.toFixed(2),
      });
    }
    assert.equal(gradients.size, 6);
  }
  for (const width of [375, 767, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.getByRole("button", { name: "Preview search", exact: true }).isVisible(),
      width >= 768,
    );
    assert.ok(await page.getByRole("button", { name: "Preview options", exact: true }).isVisible());
  }
  console.log(
    JSON.stringify({ result: "passed", measurements, breakpoints: [375, 767, 768, 1280] }),
  );
} finally {
  await browser.close();
}
