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
pnpm dev                     # frontend only, strict http://127.0.0.1:5173
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

## Contact profiles and chat settings

Prompt 09 adds contact modals, chat menus, group administration, reporting,
shared media/files, and personal clear-chat. Apply **migration 0011 after
0001–0010** manually in the SQL Editor before deploying this frontend. See the
[deployment notes and manual checklist](docs/chat-settings.md). Run
`pnpm test:chat-settings` alongside the existing checks. Calls remain part of
Prompt 12. No new dependencies are required.

### Novedades (Prompt 10)

Stories and broadcast Channels are implemented on `feat/novedades-stories-channels`.
See [implementation/deployment notes](docs/novedades.md) and
[verification status](docs/novedades-implementation-status.md). Migration 0012
is locally validated; staging application and manual end-to-end checks remain
pending. Do not change deployed migrations 0001–0011.

# PIF Shared Memory v1.0

A file-based governance and evidence system shared by **PIF Engineer v2.0** and **PIF Guardian v1.0**. This folder is a template, not evidence of a completed project.

## Getting started

1. Copy `.pif/` into the project repository, on an agreed governance branch or otherwise approved location.
2. Set the project ID, title and scope in `project.md`; approve the initial baseline.
3. Guardian maintains canonical records only when authorized. Engineer reads them and submits change proposals via `inbox/` or a PR; Engineer never silently edits the approved baseline.
4. Record implementation evidence with stable paths and revision identifiers; do not equate reported results with verified results.
5. Commit governance changes to Git for history and review. Protect sensitive content; never commit credentials.
6. Read `SHARED_MEMORY_PROTOCOL.md` for mandatory procedures and decision rules.

## Files

- `.pif/manifest.json`: schema, baseline and ownership metadata.
- `.pif/project.md`: approved purpose, boundaries and success.
- `.pif/requirements.md`: requirements and acceptance criteria.
- `.pif/roadmap.md`: milestones and task dependencies.
- `.pif/state.md`: current evidence-backed state (a snapshot, not a history rewrite).
- `.pif/traceability.md`: relationships between objectives, requirements, tasks, implementation and tests.
- `.pif/decisions/`: decision records.
- `.pif/evidence/index.md`: evidence index; artifacts may live elsewhere.
- `.pif/history/changes.md`: append-only material governance change log.
- `.pif/inbox/`: Engineer proposals and review requests (suggestions, not authoritative state).
- `.pif/handoffs/`: concise, dated handoff notes with source revision.

**Policy:** no background synchronization is implied; agents must have file access or receive explicit handoffs. Repository permissions and branch protections, where configured, enforce boundaries more reliably than prompt text alone.
