# Contact profiles and chat settings (Prompt 09)

Prompt 09 adds the 12 requested components, eight hooks, the chat-action matrix,
Zustand modal state, and three protected routes for group info, members, and
shared media. Block confirmation, avatar cropping, message search, and media
viewing reuse existing components. No new dependency is required.

## Deployment

Migrations **0001–0010 are already applied to production** and are unchanged.
The roadmap's proposed `0010_chat_settings.sql` is numbered
[`0011_chat_settings.sql`](../supabase/migrations/0011_chat_settings.sql) because
0010 already belongs to message actions.

The developer must apply the complete 0011 file manually in the Supabase SQL
Editor, after 0001–0010, before deploying this frontend. It contains a transaction:
stop and inspect any error instead of continuing with a partial schema. This
session applied it only to the isolated local validation database; neither
staging nor production was accessed. No environment or credential file changed.

The migration adds these authenticated RPCs:

| RPC | Result and authorization |
| --- | --- |
| `add_chat_members` | Adds up to 50 selected users; group admin and MFA required; skips duplicates, unavailable profiles, and blocked pairs |
| `remove_chat_member` | Removes another member; group admin and MFA required; protects the creator |
| `promote_chat_admin` | Promotes a current member; group admin and MFA required |
| `demote_chat_admin` | Demotes an admin; protects the creator from others and keeps at least one admin |
| `update_group_info` | Changes name, description, or uploaded avatar; group admin and MFA required |
| `clear_chat_for_me` | Adds personal message deletions and updates the caller's read state; membership and MFA required |

Two partial indexes support stable `(created_at DESC, id DESC)` media/file
pagination. Existing avatar Storage policies are extended to permit members to
read group photos and admins to manage them. The existing MFA restriction stays
in place. Personal avatar access remains governed by its existing visibility
rules. Group photo object paths are `chat-{chatId}/group-{timestamp}-{uuid}.webp`
in the private `avatars` bucket. The UUID suffix prevents concurrent uploads from
colliding.

Upload metadata and bytes use the existing authenticated upload flow. A failed
save removes a new upload only when a follow-up read establishes it was not
saved. Replacing a photo uploaded by another admin leaves its cleanup pending,
respecting the existing uploader-owned metadata policy. Removal passes an empty
avatar string; an omitted parameter means no change.

Database types were generated from the local database into a temporary file,
validated, and then moved into `src/types/database.ts`. Only the six new RPC
contracts changed; the existing remote view declarations were preserved. Remote
type generation remains unverified without explicitly supplied staging access.

## Behavior and boundaries

- Direct, group/community, and self menus expose the appropriate actions. Pending
  recipients cannot mutate a membership they do not have. Self chats show one
  Pin/Unpin action, not both simultaneously.
- The contact modal uses `profiles_visible`. It does not query another user's
  private settings. A masked `last_seen_at` is omitted entirely. Canonical direct
  pairs use sorted UUIDs joined by `::`, matching PostgreSQL `LEAST/GREATEST`.
- Message opens the existing direct/request conversation; messaging a group
  member can create the existing direct-request flow. Messaging yourself uses
  the existing self-chat RPC.
- Actual calling belongs to Prompt 12. Active-chat Call/Video controls remain
  disabled with “Calls coming soon”; pending-chat controls explain that the
  request must first be accepted. No calling backend was added.
- Mute uses a future timestamp, including `9999-12-31T23:59:59Z` for Always.
  `NULL` means unmuted. Mark unread returns to the list so the open conversation
  does not immediately mark itself read again.
- Group admin RPCs lock the parent chat before changing membership or roles.
  Server checks are necessary even when the UI hides an action. Creator
  protection prevents hostile removal/demotion. Bulk additions skip blocked
  users without revealing which block caused the omission.
- Contacts and global search are combined without duplicate candidates. Global
  queries debounce for 300 ms, limit results to 20, and exclude current members
  and the caller. Selection is capped at 50 in both UI and RPC.
- Group info is a protected route so it can support future deep links. The
  existing member-deletion trigger handles last-admin succession and deletion
  when the last member leaves. No old trigger was changed.
- Clear chat does not delete messages, attachments, or another person's view.
  Shared media respects message RLS. The list also checks personal deletions
  before displaying the denormalized last-message preview.
- Media and Files load only on the active tab, 30 at a time, and use signed URLs.
  Existing Realtime subscriptions refresh membership/message changes. Group
  name/avatar updates invalidate the editing client's caches immediately; other
  clients use the existing 30-second detail and 60-second list polling because
  `chats` is not in the existing Realtime publication.
- Reports use existing RLS; the reported person cannot read the report.
  “Other” requires an explanation, and descriptions are capped at 500 characters.

## Reproducible checks

```sh
node --experimental-strip-types --test tests/*.test.ts
pnpm build
pnpm lint
```

After applying 0011 to the local validation database, run the SQL assertions:

```sh
docker exec -i supabase_db_silverchat-backend-validation \
  psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < supabase/tests/chat_settings.sql
```

The suite rolls back its fixtures. It checks bulk limits, duplicates/blocks,
admin authorization, creator protection, last-admin demotion, group-only RPCs,
name/description/avatar validation, Storage access by admin/member/outsider,
personal clear/read state, visibility to another member, report privacy, leave
succession, final-member deletion, MFA, and anonymous execution denial. All six
existing SQL suites also pass after 0011.

Browser checks use the environment's Playwright Core and Chromium. No browser
library was added to the repository. Start Vite with fake test values:

```sh
VITE_SUPABASE_URL=https://supabase.test VITE_SUPABASE_ANON_KEY=test-anon \
  VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm dev --host 127.0.0.1
PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core/index.mjs node tests/chat-settings-browser.mjs
```

The browser uses mocked BFF/PostgREST/Storage/Realtime boundaries. These checks
exercise actual components, image cropping, WebP upload bytes, signed downloads,
keyboard interactions, and responsive layouts. They do not establish that a
remote deployment works.

## Verification status and manual release checklist

Local checks: 56 unit tests, seven SQL suites, production build, lint, the new
chat-settings browser suite, and existing chats/settings/messages/message-actions
browser suites. See the task report for final command results.

The following manual checklist still requires a real staging deployment with
multiple accounts. Staging credentials were requested before any remote access;
none were supplied in this session. A hosted staging project requires internet;
a local Supabase stack supplies the offline-development capability.

| Check | Local evidence | Remote manual status |
| --- | --- | --- |
| Contact info, Message, full-profile navigation, Block, Report | Modal/report/Block entry tested; existing navigation reused | Pending |
| Calls | Correct active/pending disabled explanations | Deferred to Prompt 12 |
| Eight direct actions; self and admin/member variants | Unit and browser checks | Pending |
| Mute 8h/unmute, pin/unpin, list indicators/order | New mutations plus existing list browser tests | Pending |
| Clear viewer's history/preview; others retain messages | Browser plus two-user SQL assertions | Pending |
| Admin editing; ordinary member read-only; role changes | Browser including Realtime demotion and failed save | Pending |
| Group avatar crop/upload and generic fallback | Browser and Storage RLS assertions | Pending |
| Members sorted admins first; creator badge/protection | Browser and SQL | Pending |
| Promote, demote, remove; prevent creator demotion/removal | Browser and SQL | Pending |
| Bulk add, blocked skip, duplicate skip, maximum 50 | Browser single addition, unit cap, SQL bulk cases | Pending: also select three users manually |
| Leave, redirect/toast, oldest-member promotion, final member | Browser leave and SQL triggers | Pending |
| Report reasons/Other validation, insert, confidentiality | Unit/browser and SQL | Pending |
| Media/video grid, lightbox, Files downloads, >30 pagination | Browser | Pending |
| Desktop/mobile surfaces, focus handling, no overflow | Chromium browser checks | Pending on physical devices |

Do not open a PR until the required manual end-to-end checklist passes. The
branch is pushed for review and progress preservation, without a PR. Apply
0011 and run these checks on staging before the developer's production release.
