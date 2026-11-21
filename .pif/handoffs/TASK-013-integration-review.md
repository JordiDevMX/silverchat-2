# TASK-013 — Guardian integration review

SilverChat · PR #46 · feature/calls. Manifest baseline fceb0e51750eb06ee9f6f18652f7c43f18d11585. Implementation delivery: `.pif/inbox/TASK-013-delivery.md`.

## Integration evidence

The reviewed branch integrates main at e3c49472da1878c41f5451a24854217b1d33c9ae. The feature checkpoint is 05c024770cd9a2b00412374ed966e30055ab687f. The reviewed integration commit is 9ee4f8228d13a26fa94eb2e1fa20f25aa46bb3c5.

- Messaging retains PR #64's persistent offline outbox, draft separation, FIFO retry and reconnect behavior. Optimistic messages use the public sender profile projection. The integrated Chromium outbox test passed with its mocked transport, including desktop, mobile, navigation and reconnect.
- Database types include the calls contract and the schema changes from PRs #65 and #66. GitHub Actions applied the combined migrations to a fresh local Supabase instance, executed the SQL suite and regenerated the types. The comparison against the committed file passed.
- The local integration tree passed 189 unit tests, TypeScript and the production build. PR-scoped Biome passed with warnings. [Integration CI](https://github.com/JordiDevMX/silverchat-2/actions/runs/44679112908).

## Acceptance evidence and scope

The Product Owner confirmed receipt of incoming calls from multiple app sections, the corrected video layout and the three-account busy scenario on Staging. C saw the busy result while B continued dialing A. Both B and C saw the expected history entries. These are human observations on the feature before it was integrated with main. The combined-head SQL suite exercises the busy outcomes for dialing and answered calls.

The Staging operator reported applying and inspecting migration 20261120000000. Production rollout is a separate decision.

Integration conflicts and automated checks are closed for the reviewed tree. Separate simultaneous database sessions, live outsider JWT/PostgREST, live GoTrue MFA and the real StrictMode remount probe have no new execution evidence in this review. Task-wide gate changes, acceptance and merge remain with the Product Owner. Canonical PIF records retain their existing status.

## Production follow-up after PR #46

On November 20, 2026, the Production call-history request returned HTTP 400 with PostgreSQL error `42703`: `calls.decline_reason` was missing. The merged frontend selected that column, which migration `20261116120000_calls_enhancements.sql` introduced.

The Product Owner authorized the calls database rollout and subsequently confirmed that the reported issue was resolved. The Production migration ledger and an end-to-end Production voice or video session were not independently verified in this review.
