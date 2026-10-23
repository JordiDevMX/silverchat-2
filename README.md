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

## Supabase CLI

See [docs/SUPABASE_CLI.md](./docs/SUPABASE_CLI.md) for one-time setup
(`supabase login` + `supabase link`). Quick health check:

```bash
bash scripts/setup-supabase.sh        # Linux / macOS / Git Bash
powershell -File scripts/setup-supabase.ps1   # Windows PowerShell
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
Run `pnpm test:chats` alongside the existing checks.


## Chat conversations

Prompt 08a adds message history, all nine message renderers, optimistic sends,
drafts, mentions, emoji, private attachments and media viewing. Apply **migration
0008 after 0001–0007** before releasing the frontend. See the
[conversation deployment notes and verification checklist](docs/messages.md).
Run `pnpm test:messages` alongside the existing checks. New chat/group creation
forms remain future work.

## Message actions and voice notes

Prompt 08b adds replies, reactions, editing, deletion, forwarding, local search,
pinned messages, and voice notes with exclusive playback. Apply **migration 0010
after 0001–0009** before deploying. See the [deployment notes and checklist](docs/message-actions.md).
Run `pnpm test:message-actions` alongside the existing checks. No extra library
is required; voice waveforms use SVG and native audio.
