# SilverChat UI foundation

Phase 2 establishes reusable presentation. Phase 2.1 adds glow; Phase 3 Module 1 migrates the authenticated shell. Other feature migrations remain pending.

## Theme and cascade

`src/styles/globals.css` is the single theme entry. Keep the existing Inter import,
`data-theme` provider, `.theme-*` accent classes and preference persistence.
Tailwind scans `src/`, excluding the reference project. The standalone test fixture
opts into its own source scanning without adding fixture classes to production.

The reference silver/neon palette now includes popover, bubble, sidebar and chart
tokens, radii through 4xl, gradients, shadows, scrollbars and view-transition CSS.
Use semantic utilities (`bg-popover`, `text-muted-foreground`, `border-border`)
and `cn()` from `src/lib/utils.ts`. Never wrap an OKLCH variable in `hsl()`; use
`color-mix(in oklab, var(--silver-light) 40%, transparent)` when opacity is needed.

The six legacy feature sheets remain imported at their original locations. They
are enclosed in `@layer components`, allowing utility overrides without deleting
existing selectors. Retire those selectors only with the corresponding feature.
The broad legacy input/header/label rules exclude primitives marked with
`data-slot`. Keep focus-visible and reduced-motion behavior when extending CSS.

View-transition CSS is dormant until a feature opts into named rows and guarded
state updates. No new routing or transition behavior was introduced in Phase 2.

## Primitives

Import directly from `src/components/ui/`; there is no barrel that eagerly imports
every overlay:

- `button`, `input`, `textarea`: native props and refs, disabled/invalid states,
  caller utility overrides. Button defaults to `type="button"`; submit actions
  must explicitly supply `type="submit"`. `asChild` supports existing SPA links.
- `dialog`, `sheet`: Radix focus/dismissal/portal behavior with bounded viewport
  sizing. Supply a title and description (or intentionally omit the description
  using Radix's `aria-describedby={undefined}`). Localize `closeLabel`; use
  `showCloseButton={false}` and prevent dismissal events when a workflow is busy.
  Hiding the close icon alone does not disable Escape or outside dismissal.
- `dropdown-menu`, `popover`, `hover-card`, `switch`, `separator`: reference
  presentation over Radix primitives. Label switches. Hover cards supplement
  accessible content; essential actions need a click/keyboard alternative.
- `avatar`: presentation only; accepts resolved `src`, initials and optional
  gradient. An image failure falls back for that URL; a new URL can render again.
  It never signs URLs or loads private data. Add an accessible name on the wrapper
  when identity is not already conveyed by adjacent text.
- `settings-row`: `CardSurface`, `SectionHeading`, `SettingsRow`, and
  `SettingsRowContent`. Static rows may contain controls; action rows must not
  contain nested interactive elements. Existing SPA `SettingRow` uses the same
  content while retaining its original `href` behavior.
- `card`, `skeleton`, `inline-error`: shared surfaces, loading and error display.
- `modal`, `code-input`, `app-skeleton`: compatible extractions from the existing
  auth component module. Existing import paths are re-exported unchanged.

## Existing contracts

The native `Modal` intentionally remains a native `<dialog>`: it retains top-layer
modality, nested Tab ownership, busy Escape prevention, and trigger focus return.
Do not casually replace it with the new Radix Dialog. A body portal rendered
inside a native dialog sits outside its top layer. Keep native nested overlays
native, or explicitly mount an overlay inside the native dialog and verify focus
ownership. Dialog/Sheet expose `portalContainer` for deliberate integration.

`CodeInput` retains its six-digit change/paste/backspace behavior and public props.
Only the underlying input presentation changed. `InlineError` retains its alert
role and conditional rendering; loading status remains in `AppSkeleton`.

`src/features/settings/components/shared.tsx` no longer imports Supabase:

- `hooks/useAvatar.ts` owns `useAvatarUrl` and `useAvatarGradient` unchanged:
  user/path query keys, enabled guard, timing, storage-outage handling and image
  retention remain intact.
- `hooks/useAction.tsx` retains busy/error/notice/run/feedback contracts.
- The existing `Avatar` adapter retains profile props, viewport gating, initials,
  legacy dimensions and signed-URL queries; it renders the new visual primitive.

These hooks are re-exported for existing consumers. Prefer their hook modules for
new consumers. This is a dependency-boundary cleanup, not a profile/settings page
migration.

## Review and checks

Run `pnpm dev` and open `/tests/ui-foundation.html` for the standalone review. It
does not mount app providers or access Supabase. It is not an application route
and is not included in the production entry.

Required checks:

```text
pnpm exec tsc --noEmit -p tsconfig.app.json
pnpm typecheck
pnpm test
pnpm exec vite build
node tests/ui-foundation-browser.mjs
node tests/settings-browser.mjs
```

The browser harnesses use the existing external Playwright setup: configure
`PLAYWRIGHT_MODULE_PATH` (an importable package or file URL) and `CHROMIUM_PATH`.
Start Vite on port 5173 with `VITE_SUPABASE_URL=https://supabase.test` and a dummy
`VITE_SUPABASE_ANON_KEY` when running the mocked settings harness. All settings
mutations are intercepted. The foundation harness also blocks remote requests.
`UI_ARTIFACT_DIR` can direct screenshots to an existing writable directory;
otherwise the harnesses use the OS temporary directory. The foundation harness
accepts `UI_BASE_URL` for a different Vite port.

Browser coverage includes utility/legacy cascade, button submit semantics,
switches, OTP entry, avatar recovery, native nested dialogs, keyboard menus,
Radix focus restoration, popovers, 12 theme/accent combinations, system fallback,
reduced motion, and 375/768/1280px viewport checks. The settings regression covers
profile persistence, avatar crop/upload/removal, privacy, device/account actions,
theme persistence, notifications and mobile layout.


## Glow and shell (Phase 2.1 / Module 1)

- Button defaults to a neon gradient and halo; use variant="neon-outline" for a translucent accent outline. Disabled controls suppress the halo. The checked Switch and Badge variant="neon" share these tokens.
- shadow-glow composes with focus rings. cn registers bg-gradient-neon, bg-gradient-silver and bg-ambient-glow as background images, preserving background-color fallbacks and caller overrides.
- ShellBackdrop is a static, pointer-transparent decoration for a positioned container. The bg-ambient-glow utility can also be applied directly to a surface. Both follow the existing accent; neither animates.
- AuthenticatedLayout owns the shell frame and banner placement. AppNavigation mounts once and transforms from bottom tabs to a 68px rail at lg. useAppNavigation owns the unchanged query/realtime/draft/unread work. Never mount separate live desktop/mobile navigation instances.
- app-shell.css is imported by globals.css; it replaces only the legacy navigation styles in chats.css and bridges viewport/FAB/selection geometry. Keep feature-owned headers, search state, document scroll and content sidebars intact until those modules migrate.
- Shell regression coverage lives in tests/chats-browser.mjs. All browser harnesses accept UI_BASE_URL (default http://127.0.0.1:5173) and UI_ARTIFACT_DIR for local review.
