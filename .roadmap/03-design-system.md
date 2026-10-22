# SILVERCHAT — PROMPT #3: DESIGN SYSTEM

You are a senior design engineer building the **complete visual foundation**
for **SilverChat**, a privacy-first messaging web app with a futuristic
"elegant futurism" aesthetic — silver metallic surfaces with an electric neon
accent.

This is a **greenfield project**. There is no legacy code to preserve, no
existing CSS to clean up, and no migration to worry about. You are defining
the design system **from zero**.

All decisions below are **final and locked**. Every OKLCH value listed is a
design constant, not a suggestion — do not "improve", "round", or "adjust"
them. They have been validated visually and must be used verbatim.

This prompt outputs a single file: `src/styles/globals.css` (complete) plus
one install command. No components, no utilities beyond what's specified,
no application logic.

---

## 1. TECH CONTEXT

- Tailwind CSS **v4** with CSS-first configuration (no `tailwind.config.js`)
- Vite plugin: `@tailwindcss/vite`
- TypeScript strict (already set up in Prompt #2)
- React 19, no component library (fully custom design system)
- Icons: **lucide-react** (installed in Prompt #2)
- Font: **Inter Variable** via `@fontsource-variable/inter`

---

## 2. ARCHITECTURE OVERVIEW

The design system uses a **three-layer cascade**:

1. **Accent layer** — four tokens (`--neon`, `--neon-glow`, `--neon-magenta`,
   `--neon-lime`) change per accent theme (blue default, purple, red, orange,
   yellow, green).
2. **Semantic layer** — `--primary`, `--background`, `--foreground`, etc. map
   to the accent tokens and to silver/metallic neutrals.
3. **Component layer** — gradients (`--gradient-neon`, `--gradient-silver`),
   shadows (`--shadow-glow`, `--shadow-silver`), and derived tokens cascade
   automatically from layers 1 and 2.

**Switching an accent theme overrides only layer 1.** Everything downstream
adapts without additional CSS. Switching light/dark overrides layers 1–2 and
some derived tokens in layer 3.

Theme application mechanism:

- `<html>` with no class → default accent (blue)
- `<html class="theme-purple">` → purple accent, everything else identical
- `<html data-theme="dark">` → dark mode
- Both can combine: `<html class="theme-purple" data-theme="dark">`
- Light mode is the **default**; `data-theme="light"` is optional and explicit
- System preference is respected via `@media (prefers-color-scheme: dark)` only
  when `data-theme` is NOT explicitly set to `"light"`

---

## 3. INSTALLATION

Install the font:
pnpm add @fontsource-variable/inter

Import it at the very top of `src/app/main.tsx` (before other imports):

```ts
import "@fontsource-variable/inter";
```

4. COLOR PALETTE — OKLCH VALUES (VERBATIM, DO NOT MODIFY)
   4.1 Silver neutrals (theme-agnostic)
   Light mode:

css
--silver-light: oklch(0.97 0.005 250);
--silver: oklch(0.9 0.008 250);
--silver-dark: oklch(0.78 0.012 250);
Dark mode:

css
--silver-light: oklch(0.32 0.012 255);
--silver: oklch(0.24 0.014 255);
--silver-dark: oklch(0.18 0.016 255);
4.2 Accent tokens — default (Neon Blue)
css
--neon: oklch(0.62 0.22 255);
--neon-glow: oklch(0.72 0.18 250);
--neon-magenta: oklch(0.7 0.2 210);
--neon-lime: oklch(0.85 0.2 130);
These four tokens are overridden by .theme-\* classes (section 6).

4.3 Semantic color mapping — light mode
css
--bubble-self: var(--neon);
--bubble-other: oklch(0.98 0.003 250);

--background: oklch(0.96 0.006 250);
--foreground: oklch(0.2 0.03 255);
--card: oklch(0.99 0.003 250);
--card-foreground: oklch(0.2 0.03 255);
--popover: oklch(0.99 0.003 250);
--popover-foreground: oklch(0.2 0.03 255);

--primary: var(--neon);
--primary-foreground: oklch(0.99 0.003 250);
--secondary: var(--silver);
--secondary-foreground: oklch(0.22 0.04 255);
--muted: var(--silver-light);
--muted-foreground: oklch(0.48 0.03 255);
--accent: oklch(0.92 0.04 250);
--accent-foreground: oklch(0.25 0.08 255);
--destructive: oklch(0.62 0.23 25);
--destructive-foreground: oklch(0.99 0 0);
--border: oklch(0.88 0.01 250);
--input: oklch(0.92 0.008 250);
--ring: var(--neon);
4.4 Semantic color mapping — dark mode
css
--bubble-self: var(--neon);
--bubble-other: oklch(0.26 0.015 255);

--background: oklch(0.16 0.014 255);
--foreground: oklch(0.96 0.005 250);
--card: oklch(0.2 0.014 255);
--card-foreground: oklch(0.96 0.005 250);
--popover: oklch(0.2 0.014 255);
--popover-foreground: oklch(0.96 0.005 250);
--primary: var(--neon);
--primary-foreground: oklch(0.12 0.01 255);
--secondary: oklch(0.26 0.015 255);
--secondary-foreground: oklch(0.96 0.005 250);
--muted: oklch(0.24 0.014 255);
--muted-foreground: oklch(0.7 0.02 250);
--accent: oklch(0.3 0.05 250);
--accent-foreground: oklch(0.96 0.005 250);
--destructive: oklch(0.68 0.2 25);
--destructive-foreground: oklch(0.99 0 0);
--border: oklch(1 0 0 / 10%);
--input: oklch(1 0 0 / 14%);
--ring: var(--neon);
Dark mode also redefines the accent tokens (before theme override cascades):

css
--neon: oklch(0.7 0.22 250);
--neon-glow: oklch(0.78 0.18 245);
--neon-magenta: oklch(0.78 0.2 210);
--neon-lime: oklch(0.85 0.2 130);
4.5 Signature gradients & shadows — light mode
css
--gradient-silver: linear-gradient(
135deg,
oklch(0.98 0.004 250) 0%,
oklch(0.88 0.012 250) 50%,
oklch(0.95 0.006 250) 100%
);
--gradient-neon: linear-gradient(135deg, var(--neon) 0%, var(--neon-magenta) 100%);
--shadow-glow:
0 0 24px -4px color-mix(in oklab, var(--neon) 55%, transparent),
0 0 8px 0 color-mix(in oklab, var(--neon) 35%, transparent);
--shadow-silver: 0 4px 16px -4px color-mix(in oklab, oklch(0.5 0.03 255) 22%, transparent);
4.6 Signature gradients & shadows — dark mode
css
--gradient-silver: linear-gradient(
135deg,
oklch(0.24 0.014 255) 0%,
oklch(0.3 0.018 255) 50%,
oklch(0.22 0.014 255) 100%
);
--gradient-neon: linear-gradient(135deg, var(--neon) 0%, var(--neon-magenta) 100%);
--shadow-glow:
0 0 32px -2px color-mix(in oklab, var(--neon) 70%, transparent),
0 0 12px 0 color-mix(in oklab, var(--neon) 40%, transparent);
--shadow-silver: 0 4px 18px -4px oklch(0 0 0 / 0.5);
4.7 Chart palette — light mode
css
--chart-1: var(--neon);
--chart-2: var(--neon-magenta);
--chart-3: oklch(0.55 0.18 270);
--chart-4: var(--neon-lime);
--chart-5: oklch(0.45 0.2 260);
Dark mode:

css
--chart-1: var(--neon);
--chart-2: var(--neon-magenta);
--chart-3: oklch(0.6 0.2 270);
--chart-4: var(--neon-lime);
--chart-5: oklch(0.5 0.22 260);
4.8 Sidebar tokens — light mode
css
--sidebar: oklch(0.94 0.008 250);
--sidebar-foreground: oklch(0.22 0.03 255);
--sidebar-primary: var(--neon);
--sidebar-primary-foreground: oklch(0.99 0.003 250);
--sidebar-accent: oklch(0.9 0.012 250);
--sidebar-accent-foreground: oklch(0.22 0.04 255);
--sidebar-border: oklch(0.86 0.012 250);
--sidebar-ring: var(--neon);
Dark mode:

css
--sidebar: oklch(0.2 0.014 255);
--sidebar-foreground: oklch(0.96 0.005 250);
--sidebar-primary: var(--neon);
--sidebar-primary-foreground: oklch(0.12 0.01 255);
--sidebar-accent: oklch(0.26 0.015 255);
--sidebar-accent-foreground: oklch(0.96 0.005 250);
--sidebar-border: oklch(1 0 0 / 10%);
--sidebar-ring: var(--neon);
4.9 Radii
css
--radius: 0.875rem; /_ 14px — base, used for bubbles, cards, inputs _/
Tailwind utility radii are exposed via @theme inline (section 5) as:

rounded-sm → 0.375rem (6px) — small chips, tags

rounded-md → 0.625rem (10px) — buttons, small cards

rounded-lg → var(--radius) (14px) — message bubbles, main cards

rounded-xl → 1.25rem (20px) — modals, large containers

rounded-2xl → 1.75rem (28px) — story cards

rounded-full → avatars, FAB, badges

Message bubbles have NO tail/peak. Fully rounded on all corners.

5. TAILWIND v4 BRIDGE — @theme inline
   Add a @theme inline block immediately after @import "tailwindcss"; and
   before :root. The inline modifier is required because all referenced
   values are dynamic CSS variables — without it, Tailwind resolves at build time
   and theme switching breaks.

css
@theme inline {
/_ Colors — generates bg-_, text-_, border-_, ring-_, etc. _/
--color-background: var(--background);
--color-foreground: var(--foreground);
--color-card: var(--card);
--color-card-foreground: var(--card-foreground);
--color-popover: var(--popover);
--color-popover-foreground: var(--popover-foreground);
--color-primary: var(--primary);
--color-primary-foreground: var(--primary-foreground);
--color-secondary: var(--secondary);
--color-secondary-foreground: var(--secondary-foreground);
--color-muted: var(--muted);
--color-muted-foreground: var(--muted-foreground);
--color-accent: var(--accent);
--color-accent-foreground: var(--accent-foreground);
--color-destructive: var(--destructive);
--color-destructive-foreground: var(--destructive-foreground);
--color-border: var(--border);
--color-input: var(--input);
--color-ring: var(--ring);
--color-neon: var(--neon);
--color-silver-light: var(--silver-light);
--color-silver: var(--silver);
--color-silver-dark: var(--silver-dark);
--color-bubble-self: var(--bubble-self);
--color-bubble-other: var(--bubble-other);
--color-sidebar: var(--sidebar);
--color-sidebar-foreground: var(--sidebar-foreground);
--color-sidebar-primary: var(--sidebar-primary);
--color-sidebar-accent: var(--sidebar-accent);

/_ Radii _/
--radius-sm: 0.375rem;
--radius-md: 0.625rem;
--radius-lg: var(--radius);
--radius-xl: 1.25rem;
--radius-2xl: 1.75rem;

/_ Font _/
--font-sans: "Inter Variable", "Inter", system-ui, -apple-system, sans-serif;

/_ Font sizes (line-heights applied in components, not here) _/
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--text-2xl: 1.5rem;
--text-3xl: 1.875rem;

/_ Shadows _/
--shadow-glow: var(--shadow-glow);
--shadow-silver: var(--shadow-silver);

/_ Easings (for Tailwind easing utilities) _/
--ease-out: var(--ease-out);
--ease-in-out: var(--ease-in-out);
--ease-spring: var(--ease-spring);
} 6. ACCENT THEMES — SIX .theme-_ CLASSES
Define all six accent theme classes at :root.theme-_ scope. Each overrides
only the four accent tokens. Everything else cascades.

css
:root.theme-blue {
--neon: oklch(0.62 0.22 255);
--neon-glow: oklch(0.72 0.18 250);
--neon-magenta: oklch(0.7 0.2 210);
--neon-lime: oklch(0.85 0.2 130);
}

:root.theme-purple {
--neon: oklch(0.58 0.24 300);
--neon-glow: oklch(0.72 0.2 305);
--neon-magenta: oklch(0.7 0.22 330);
--neon-lime: oklch(0.85 0.2 130); /_ fallback from :root _/
}

:root.theme-red {
--neon: oklch(0.62 0.24 25);
--neon-glow: oklch(0.72 0.2 25);
--neon-magenta: oklch(0.7 0.22 350);
--neon-lime: oklch(0.85 0.2 130);
}

:root.theme-orange {
--neon: oklch(0.7 0.2 50);
--neon-glow: oklch(0.78 0.18 55);
--neon-magenta: oklch(0.72 0.2 80);
--neon-lime: oklch(0.85 0.2 130);
}

:root.theme-yellow {
--neon: oklch(0.82 0.2 95);
--neon-glow: oklch(0.88 0.16 100);
--neon-magenta: oklch(0.82 0.2 130);
--neon-lime: oklch(0.78 0.2 280); /_ flipped for contrast _/
}

:root.theme-green {
--neon: oklch(0.72 0.22 145);
--neon-glow: oklch(0.82 0.18 145);
--neon-magenta: oklch(0.7 0.22 175);
--neon-lime: oklch(0.78 0.22 330); /_ flipped for contrast _/
}
Dark mode accent overrides (higher specificity, applied when both dark mode and
an accent theme are active):

css
:root[data-theme="dark"].theme-blue {
--neon: oklch(0.7 0.22 250);
--neon-glow: oklch(0.78 0.18 245);
--neon-magenta: oklch(0.78 0.2 210);
--neon-lime: oklch(0.85 0.2 130);
}

:root[data-theme="dark"].theme-purple {
--neon: oklch(0.72 0.24 295);
--neon-glow: oklch(0.82 0.18 300);
--neon-magenta: oklch(0.78 0.2 330);
}

:root[data-theme="dark"].theme-red {
--neon: oklch(0.7 0.24 25);
--neon-glow: oklch(0.8 0.2 25);
--neon-magenta: oklch(0.78 0.2 350);
}

:root[data-theme="dark"].theme-orange {
--neon: oklch(0.76 0.2 50);
--neon-glow: oklch(0.84 0.16 55);
--neon-magenta: oklch(0.78 0.2 80);
}

:root[data-theme="dark"].theme-yellow {
--neon: oklch(0.88 0.2 95);
--neon-glow: oklch(0.92 0.16 100);
--neon-magenta: oklch(0.88 0.2 130);
}

:root[data-theme="dark"].theme-green {
--neon: oklch(0.78 0.22 145);
--neon-glow: oklch(0.86 0.18 145);
--neon-magenta: oklch(0.78 0.2 175);
}
Note on specificity: [data-theme="dark"].theme-_ combined selectors have
higher specificity than plain .theme-_ and [data-theme="dark"] alone, so
dark + accent themes resolve correctly.

7. DARK MODE — THREE RULES
   :root without data-theme → light tokens (default).

@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }
→ system dark preference, unless user explicitly chose light.

:root[data-theme="dark"] { ... } → explicit dark override.

Rule 2 and Rule 3 must NOT both fire on the same <html>. Use the
:not([data-theme="light"]) guard on Rule 2. Rule 3 has higher specificity
via attribute selector. Extract the dark token list into a comment-guarded
block, and duplicate the values between Rule 2 and Rule 3 (CSS has no
clean "reuse a token block" primitive and duplication is fine for a static
file).

Do NOT include any @media (prefers-color-scheme: dark) block that
overrides tokens not related to SilverChat's palette. Only the tokens defined
in section 4.4 belong inside it.

8. MOTION TOKENS
   Add to the :root block:

css
--duration-fast: 150ms;
--duration-base: 200ms;
--duration-slow: 300ms;
--duration-slower: 400ms;

--ease-out: cubic-bezier(0.2, 0, 0, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
Rule enforced app-wide: every transition and animation in the codebase
MUST reference these tokens. No hardcoded transition: 250ms anywhere.

Reduced motion — add to @layer base:

css
@media (prefers-reduced-motion: reduce) {
_,
_::before,
\*::after {
animation-duration: 0.01ms !important;
animation-iteration-count: 1 !important;
transition-duration: 0.01ms !important;
scroll-behavior: auto !important;
}
} 9. GLASSMORPHISM TOKENS
Add to :root (light mode):

css
--glass-bg: color-mix(in oklch, var(--card) 70%, transparent);
--glass-blur: 16px;
--glass-border: 1px solid color-mix(in oklch, white 40%, transparent);
--glass-saturate: 1.4;
Override in :root[data-theme="dark"] AND inside the
@media (prefers-color-scheme: dark) guard:

css
--glass-bg: color-mix(in oklch, var(--card) 55%, transparent);
--glass-blur: 20px;
--glass-border: 1px solid color-mix(in oklch, white 8%, transparent);
--glass-saturate: 1.2;
Utility class in @layer components:

css
.glass-surface {
background: var(--glass-bg);
backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
-webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
border: var(--glass-border);
}
Approved glass surfaces (documentation, implemented in later prompts):
header, footer nav, modal backdrops, FAB (semi-glass), call overlay.

Not glass: message bubbles, list items, cards (solid backgrounds for
legibility).

10. TYPOGRAPHY
    Font stack:

css
--font-sans: "Inter Variable", "Inter", system-ui, -apple-system, sans-serif;
Apply in @layer base:

css
html, body {
font-family: var(--font-sans);
font-feature-settings: "cv02", "cv03", "cv04", "cv11";
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
}
Type scale usage (documentation for future prompts):

text-xs (12/16) → timestamps, badges, metadata

text-sm (14/20) → last message previews, labels, helper text

text-base (16/24) → message bubbles, input text, primary body

text-lg (18/28) → contact name in chat header

text-xl (20/28) → section titles ("Comunidades", "Llamadas")

text-2xl (24/32) → page titles

text-3xl (30/36) → login/onboarding only

Font weights allowed: 400 (regular), 500 (medium), 600 (semibold),
700 (bold). Do not use 300 (too thin) or 800/900 (too aggressive for
"elegant futurism").

Tabular numbers: font-variant-numeric: tabular-nums for all timestamps,
counters, and call durations. Tailwind class: tabular-nums.

11. BASE LAYER — GLOBAL RULES
    Add a @layer base block containing:

11.1 Reset
css
_, _::before, \*::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; text-rendering: optimizeLegibility; }
body {
background: var(--background);
color: var(--foreground);
font-family: var(--font-sans);
font-feature-settings: "cv02", "cv03", "cv04", "cv11";
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
}
::selection { background: var(--primary); color: var(--primary-foreground); }
11.2 Focus-visible (accessibility)
css
:focus-visible {
outline: 2px solid var(--ring);
outline-offset: 2px;
border-radius: var(--radius-sm);
}
:focus:not(:focus-visible) { outline: none; }
11.3 Scrollbar (subtle, themed)
css

- {
  scrollbar-width: thin;
  scrollbar-color: var(--silver-dark) transparent;
  }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
  background: var(--silver-dark);
  border-radius: 9999px;
  }
  11.4 Touch behavior
  css
  button, [role="button"], a {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
  }
  11.5 Reduced motion (see section 8)

12. UTILITY LAYER
    12.1 Skeleton / shimmer
    css
    @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
    }
    .skeleton {
    background: linear-gradient(
    90deg,
    var(--muted) 0%,
    var(--silver) 50%,
    var(--muted) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
    border-radius: var(--radius-md);
    }
    12.2 Tabular numbers
    css
    .tabular-nums { font-variant-numeric: tabular-nums; }
    (Tailwind v4 provides this by default — include only if missing.)

13. ICONOGRAPHY CONVENTIONS (documentation only)
    Library: lucide-react

Default size: 20px

Sizes: 16 (inline), 20 (default), 24 (header/main actions), 28
(FAB), 32 (large controls, empty states)

Stroke width: 1.75 everywhere

Color: inherited via currentColor — never set directly on <svg>

Every icon-only button MUST have aria-label

A wrapper component src/components/ui/Icon.tsx defaulting
strokeWidth={1.75} size={20} will be created in a later prompt. Do not
create it here.

14. ACCESSIBILITY RULES (enforced app-wide)
    WCAG AA contrast minimum: 4.5:1 for body text, 3:1 for large text and
    UI components. Verify at least these pairs:

foreground on background

foreground on card

primary-foreground on primary

muted-foreground on muted

destructive-foreground on destructive

Never use color as sole state indicator. Every state (unread, failed,
verified, muted) combines color + icon OR color + text.

prefers-reduced-motion respected (section 8).

Keyboard navigation on every interactive element. Focus ring visible
via :focus-visible (section 11.2).

Touch targets minimum 44×44px on mobile. Visual elements can be
smaller, but the hit area cannot.

All icon-only buttons have aria-label.

Modal focus trap required — documented here, enforced in component
code later.

15. WHAT TO DO NOT DO IN THIS PROMPT
    ❌ Do NOT modify any OKLCH value listed above.

❌ Do NOT create UI components (Button, Input, Card, etc.).

❌ Do NOT install any animation library (no motion, framer-motion, GSAP).

❌ Do NOT create tailwind.config.js — Tailwind v4 is CSS-first.

❌ Do NOT add themes beyond the six listed.

❌ Do NOT add fonts beyond Inter Variable.

❌ Do NOT add utility classes beyond .glass-surface, .skeleton,
.tabular-nums (if missing).

❌ Do NOT include any @media (prefers-color-scheme: dark) block with
tokens not defined in section 4.

❌ Do NOT create the Icon.tsx wrapper — later prompt.

❌ Do NOT touch any file other than src/styles/globals.css and
src/app/main.tsx (for the font import).

16. FILE STRUCTURE FOR THIS PROMPT
    Output exactly:

The install command (pnpm add @fontsource-variable/inter).

The complete content of src/styles/globals.css, ordered as:

@import "tailwindcss";

@theme inline { ... } bridge

:root { ... } (light tokens + motion + glass)

Six .theme-\* blocks

:root[data-theme="dark"] { ... } (dark tokens + motion + glass +
dark shadow overrides)

@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }
(dark tokens only — duplicated from [data-theme="dark"])

Six :root[data-theme="dark"].theme-\* blocks

@layer base { ... } (reset, typography, focus, scrollbar, touch,
reduced-motion)

@layer components { .glass-surface }

@layer utilities { .skeleton, @keyframes shimmer, .tabular-nums }

The one-line snippet to add at the top of src/app/main.tsx.

No other files.

17. HOW TO RESPOND
    Respond in this exact order:

One-paragraph confirmation that you understood this is a greenfield
setup with locked OKLCH constants, and you will output only the design
system files.

The pnpm add command to install the font.

The complete src/styles/globals.css — all sections in the exact order
specified in section 16.

The import snippet for src/app/main.tsx.

A diff-style summary of what's included, grouped by layer:

Bridge: @theme inline with X color tokens, Y radii, font + sizes

Light mode: silver + accent + semantic + gradients + shadows + chart +
sidebar + motion + glass + radius

Dark mode: same tokens, dark values

Accent themes: 6 variants (light) + 6 variants (dark)

Base layer: reset, typography, focus, scrollbar, touch, reduced motion

Components layer: .glass-surface

Utilities: .skeleton, .tabular-nums

A verification checklist the developer can run manually:

pnpm dev runs with zero CSS parse errors

Open app: light mode, Inter font loaded (DevTools → Computed →
font-family)

bg-primary text-primary-foreground renders correctly

Toggle <html data-theme="dark">: all dark tokens apply, no double
firing with the @media block

Toggle <html class="theme-purple">: accent turns purple, silver stays,
shadows/gradients follow

Test <html class="theme-purple" data-theme="dark">: combined selector
wins correctly

Chrome DevTools → Rendering → Emulate prefers-reduced-motion: all
transitions disabled

Tab through any focusable element: focus ring visible

Add class="glass-surface" to a <div>: blur applies in both modes

A short list of pitfalls to warn the developer about:

Why @theme inline is required (not plain @theme) for dynamic
variables

Why dark mode has three rules and how they avoid double-firing

Why dark accent overrides use combined selectors for specificity

Why color values must not be touched — they are locked design constants
