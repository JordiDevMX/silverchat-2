# Project Baseline

- **Project ID:** SilverChat
- **Project Name:** SilverChat
- **Status:** APPROVED — INITIAL GOVERNANCE BASELINE (`2026-11-10`)
- **Baseline revision:** `fceb0e51750eb06ee9f6f18652f7c43f18d11585`

## Problem and purpose

SilverChat is a privacy-first real-time messaging web application (`SPA`) with a futuristic silver + electric-blue design language, offering direct chats, group chats, message requests, 24-hour stories, broadcast channels, hierarchical communities, voice/video calls, and offline/PWA capabilities (`README.md`, `.roadmap/01-foundations.md`).

## Goals

- **GOAL-001 (`USER_APPROVED` baseline objective — `.roadmap/01-foundations.md`, `README.md`):** Deliver a privacy-first messaging web application with strict PostgreSQL Row Level Security (`RLS`), AAL2 MFA enforcement, column-level privacy (`profiles_visible`), and short-lived signed Storage URLs.
- **GOAL-002 (`USER_APPROVED` baseline objective — `.roadmap/01-foundations.md`):** Operate at `$0/month` during the MVP phase (Supabase, LiveKit Cloud, Resend, Netlify free tiers) while preserving a billing-only upgrade path from `~3` to `~10,000` concurrent users without backend or frontend rewrites.
- **GOAL-003 (`USER_APPROVED` baseline objective — `.roadmap/03-design-system.md`, `UI_MIGRATION_MAP.md`):** Maintain a cohesive silver + electric-blue OKLCH theme and glassmorphism UI across desktop and mobile without breaking SPA routing, BFF auth, or Supabase data contracts.

## Scope

**In (`USER_APPROVED` governance baseline from `.roadmap/01-foundations.md` → `.roadmap/16-deployment-metadata.md` & `UI_MIGRATION_MAP.md`):**
- Incremental specification milestones Prompts `#1`–`#16` (`.roadmap/01-foundations.md` through `.roadmap/16-deployment-metadata.md`).
- Phased UI Foundation and Visual Transplant Modules `1`–`6A` (`UI_MIGRATION_MAP.md`, `docs/ui-foundation.md`, `docs/ui-module-6a.md`).
- Resilience and operational hardening (`docs/query-storm-fix.md`, `docs/story-media-burst-fix.md`, `docs/FASE-2.md`).

**Out (Documented Exclusions):**
- Native mobile binaries (iOS/Android); delivered as a responsive web SPA / PWA (`.roadmap/02-stack-setup.md`, `.roadmap/13-pwa-offline.md`).
- Password, phone/SMS, or OAuth social login (`magic-link` + TOTP AAL2 + backup codes only per `.roadmap/05-authentication.md` and `docs/authentication.md`).
- SSR/Vinxi/`@tanstack/react-start` runtime migration (`UI_MIGRATION_MAP.md`).
- Multi-million-user distributed backend re-architecture during MVP (`.roadmap/01-foundations.md`).

## Constraints and non-goals

- **CON-001 (Locked Infrastructure Stack):** Supabase (Postgres, Auth, Storage, Realtime, Edge Functions), LiveKit Cloud, Resend SMTP, and Netlify (Hosting + Auth BFF functions) per `.roadmap/01-foundations.md`.
- **CON-002 (Frontend Stack & Tooling):** Node `20+`, `pnpm 9+` (enforced via `preinstall`), Vite 6, React 19, TypeScript strict, Tailwind CSS v4 OKLCH, TanStack Router & Query, Zustand, Biome (`README.md`, `.roadmap/02-stack-setup.md`).
- **CON-003 (Data Portability & Security Boundary):** Standard PostgreSQL schema compatible with `pg_dump`; no `service_role` keys exposed in client `VITE_*` variables; refresh tokens confined to `HttpOnly` BFF cookies; actual secrets stored only in gitignored `.env` / `.env.local` files (`.roadmap/01-foundations.md`, `docs/authentication.md`, `EVID-010`).
- **CON-004 (Brownfield Continuity & Out-of-Sequence Roadmap Progress):** SilverChat was developed prior to PIF introduction. Features implemented earlier than their numbered roadmap sequence (including `en`/`es` localization, theme persistence, Magic Link + 2FA authentication, RLS, device management, and account deletion affecting Prompts `14` and `15`) are preserved as intentional historical progress rather than defects. Completed functionality does not require re-implementation or blanket re-testing merely because PIF was introduced or because its original roadmap number occurs later; however, historical implementations are not retroactively marked `ACCEPTED` without explicit Product Owner acceptance.

## Definition of Success

- Applicable roadmap milestones implemented and verified against their specification acceptance criteria without regressions in existing suites.
- Database migrations (`supabase/migrations/0001..0014+`) deterministically tracked and aligned across local, staging, and production environments.
- Zero exposed secrets or unauthorized bypasses of RLS/AAL2 security gates.
- Explicit Product Owner acceptance recorded for completed milestones and release readiness.

## Approvals

- **2026-11-10 (`USER_APPROVED` — Initial Reconciliation Authorization, `CHG-001`):** Product Owner authorized governance-only baseline reconciliation at revision `fceb0e51750eb06ee9f6f18652f7c43f18d11585`, English (`en`) documentation language, and non-retroactive `ACCEPTED` classification rule.
- **2026-11-10 (`USER_APPROVED` — Final Governance Baseline Approval, `CHG-002`):** Product Owner approved the reconciled `.pif/` records as SilverChat's initial `APPROVED` governance baseline (`fceb0e51750eb06ee9f6f18652f7c43f18d11585`), subject to explicit scope boundaries: this approval covers the accuracy, structure, and use of the governance baseline reference only, and does **not** constitute retrospective acceptance of historical feature implementations, independent verification of historical test results, production readiness approval, or authorization to deploy or modify application code.
