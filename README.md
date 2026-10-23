# SilverChat

Privacy-first messaging web app with a futuristic silver + electric-blue design
language. Real-time chats, stories, channels, communities, calls, and offline
support — built as an SPA on Vite + React 19 + TypeScript + Tailwind CSS v4,
with Supabase (DB/Auth/Storage/Realtime), LiveKit (calls), and Netlify (hosting).

## Prerequisites

- **Node 20+** — [nodejs.org](https://nodejs.org)
- **pnpm 9+** — enforced by a `preinstall` hook (`npm` and `yarn` will be rejected)
- **Supabase CLI** — for schema migrations and type generation (installed as a
  dev dependency, or install globally: `npm i -g supabase`)

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill in real Supabase values
pnpm dev                     # dev server at http://localhost:5173
pnpm typecheck               # verify zero TypeScript errors
pnpm lint                    # verify zero Biome lint/format errors
```

## Scripts

| Script          | What it does                                                     |
| --------------- | ---------------------------------------------------------------- |
| `pnpm dev`      | Start the Vite dev server                                        |
| `pnpm build`    | Type-check then production build                                 |
| `pnpm lint`     | Biome check (lint + format)                                      |
| `pnpm db:types` | Regenerate `src/types/database.ts` from the live Supabase schema |

## Roadmap

This project is built incrementally through **16 spec prompts** that live in
[`.roadmap/`](./.roadmap) (`01-foundations.md` → `16-deployment-metadata.md`).
Each implementation session follows one prompt file, in roadmap order.

## Profile and settings

Prompt 06 adds profile/avatar editing, account and device settings, privacy,
appearance, in-app notification preferences and account-deletion scheduling.
See [deployment and verification instructions](docs/profile-settings.md) before
releasing: migrations **0005–0006**, private Storage buckets, single-confirmation
email settings and the Netlify scheduled function must be configured together.
Run `pnpm test:auth` and `pnpm test:settings` alongside build and lint.

## Chats list

Prompt 07 adds the active chat list, seven filters, local search, message
requests, realtime unread/receipt updates, drafts, selection and touch actions.
Apply **migration 0007 after 0001–0006 before deploying the frontend**. See the
[chat-list deployment notes and verification checklist](docs/chats-list.md).
Run `pnpm test:chats` alongside the existing checks. Chat composition and
creation forms remain reserved for Prompt 08.
