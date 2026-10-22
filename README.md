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

| Script        | What it does                                                  |
| ------------- | ------------------------------------------------------------- |
| `pnpm dev`    | Start the Vite dev server                                     |
| `pnpm build`  | Type-check then production build                              |
| `pnpm lint`   | Biome check (lint + format)                                   |
| `pnpm db:types` | Regenerate `src/types/database.ts` from the live Supabase schema |

## Roadmap

This project is built incrementally through **16 spec prompts** that live in
[`.roadmap/`](./.roadmap) (`01-foundations.md` → `16-deployment-metadata.md`).
Each implementation session follows one prompt file, in roadmap order.
