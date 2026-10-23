# Prompt 10 — implemented and locally verified; staging pending

The original stopped draft is replaced by
`supabase/migrations/0012_stories_channels.sql`. Version 0011 remains the
previous chat-settings migration. No migration 0001–0011 or environment file
was changed.

The feature includes all 16 requested components and 16 hooks, the three main
routes, the Explore placeholder, story colors/ordering helpers, and integration
with the existing composer, uploads, message list and message actions. See
[novedades.md](novedades.md) for implementation and deployment details.

## Local verification

- All migrations 0001–0012 compiled in order against a rebuilt public schema
  inside a rollback-only transaction on the isolated local Supabase database.
- The final 0012 schema and policies are applied to that local database.
- Nine SQL suites pass, including Stories/Channels behavior and Storage RLS.
- Two concurrent database sessions contend for story 10: one succeeds, the
  other receives the cap error, and exactly 10 active stories remain.
- 59 unit/BFF tests pass.
- Chromium tests cover the Novedades flows with mocked HTTP/Realtime boundaries;
  existing messages, message-actions and chat-settings browser suites pass.
- Production build and lint pass. No dependencies were added.
- TypeScript declarations for the new columns/RPCs were derived from the local
  PostgreSQL catalog and extended for the composite message return type/FKs.
  This is **not** a remote schema regeneration.

## Staging blocker and remaining release work

Both staging environment bindings are present, and the project ref differs
from production. The bound Management API token returned HTTP 401:

```json
{"message":"Format is Authorization: Bearer [token]"}
```

No token value was printed. Neither production nor staging schema was modified.
The developer confirmed staging already contains migrations 0001–0011.

1. Supply a working staging Management API token binding, or apply 0012 manually
   in the **staging** SQL Editor.
2. Verify the live RPC signatures, policies, private buckets and publication;
   regenerate full types from that staging schema through a working endpoint,
   using a temporary file and atomic replacement.
3. Run the manual multi-user staging checklist in `novedades.md`, including real
   Storage, Auth/AAL2, Realtime delivery, and physical-device camera/gestures.
4. Open a PR only after that required manual staging validation passes. The
   feature branch can be pushed for review without claiming staging readiness.

No requested Prompt 10 surface is deliberately left as a placeholder except
Explore, which the roadmap explicitly defines as a Discover-only placeholder.
The remaining release work is integration verification on staging, not another
round of planned feature implementation. No Prompt 11+ work is included.
