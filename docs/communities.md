# Communities implementation (Prompt 11)

Branch: `feat/communities`. Migration 0014 was applied manually by the developer and verified in production.
This is an implementation record, not the developer's Prompt 11 acceptance report.
Production catalog verification passed. The implementation is ready for the single commit/push and the developer's separate acceptance checklist. No PR is authorized.

## Context and migration numbering

The root `graphify-out` report/graph and project documentation were consulted alongside
`.roadmap/11-communities.md`, Prompt 09's deferred checks, and the repository's Postgres,
React, composition and Tailwind skills. There is no `docs/10-verification.md` in this checkout.
Roadmap migration numbers are historical: the actual next migration is **0014** because
0001 through 0013 already exist. Those migration files are unchanged.

## Implementation

All nine requested components, ten hooks, five routes and the community action matrix are present.
Two small supporting components share creation-dialog focus management and community settings actions.

- The persistent desktop layout has a 320px sidebar at >=1024px. Mobile shows a full-screen child.
  The desktop index uses the spec-permitted “Select a chat” pane. Legacy /chats/:id community
  links redirect to the community layout, preserving message deep links.
- Cards default collapsed, store expansion under the specified localStorage key, show three
  activity-ordered previews, and provide the full chat-list link. Search is membership-only.
- The existing Conversation renders MessageList, Composer, reply drafts, message actions,
  pins and search with CommunityChatHeader injected. Mount marks read through the existing
  atomic RPC (which updates last_read_at, manual-unread and receipts).
- GroupSettingsScreen takes a group/community context. GroupMembersList and AddMembersModal
  share the same UI with community-specific data and RPCs. Owner identity follows succession.
- Avatars reuse AvatarPickerModal and its react-easy-crop editor. Community uploads use
  avatars/community-{id}/community-{timestamp}-{uuid}.webp and existing upload/cleanup logic.
- Both creation dialogs use focus-trap-react around the shared native dialog. The parent trap
  pauses while the nested crop dialog is open. Failed photo saves retain the created community ID.
- Chat options retain per-chat mute, unread, pin, clear and search, and navigate to Community info.
  This follows the implementation brief and roadmap sections 8/12 where they conflict with CM9.
- Community queries use cached, batched reads. Existing message/membership/receipt subscriptions
  invalidate community chat lists; no community or community_members subscription is added.
  Avatars retain the existing IntersectionObserver and signed-URL cache.
- Individual community-chat leave/delete controls are excluded from the main chat-list menus and
  mixed-selection deletion. Membership is managed at community scope.

## Migration 0014

The transaction contains the eight requested RPCs, rewritten create_community (atomic General
chat creation), and the two required succession triggers. Succession selects the oldest admin,
then oldest member, then deletes an empty community. UUID breaks equal joined_at ties.
The profile trigger runs BEFORE DELETE so ownership is transferred before its FK becomes NULL.
RPCs require authentication/MFA, use an empty search_path and explicit grants/revocations.
Community mutations lock the parent row before changing children.

Supporting integration SQL is necessary with the existing schema:

- An admin-only join_community(uuid, uuid) overload adds each selected member individually;
  the original join_community(uuid) self-join contract remains available and is serialized.
- A role-update trigger synchronizes child-chat moderation roles, including succession.
- Community avatar Storage policies allow member reads and admin writes.
- Existing group management RPCs now require a group, preventing community membership drift.
  The group-member deletion trigger no longer independently promotes/deletes community chats.
- Community writes go through their RPCs; child-chat DELETE policy excludes community chats.
  Direct/group/self behavior otherwise retains its existing policy boundaries.

## Local verification

- TypeScript: pass.
- Unit tests: 69 passing, including community RPC adapter success/error paths, action matrices,
  card ordering, timestamp formatting, settings adaptation and SQL contract guards.
- Production build: pass.
- Changed-file Biome checks and full-repository checks with formatting disabled: pass.
  Stock pnpm lint still reports 237 pre-existing formatting diagnostics in untouched files;
  the unrelated existing ConnectionBanner import-order diagnostic was corrected.
- PostgreSQL parser: 59 SQL statements and 20 PL/pgSQL function bodies parse successfully.
  The parser is a temporary validation dependency, not a project dependency. Local validation did not apply SQL; production application was subsequently completed manually by the developer.
- Communities Chromium suite: pass with mocked BFF/PostgREST/Storage/Realtime boundaries.
  Covers crop/upload, focus loops, errors/retry, cards/search/persistence, 320px desktop/sidebar,
  mobile/back navigation/no horizontal overflow, message composer/menu/read, shared settings,
  member addition/promotion, mute, member-only controls, owner warnings, deletion, access redirect.
- Existing chat-settings Chromium regression suite: pass. Its screenshot paths now use tmpdir,
  and avatar verification waits for save completion instead of a fixed 350ms delay.
- Desktop/mobile screenshots were visually inspected.

Reproduce with `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm lint`.
For browser suites, provide PLAYWRIGHT_MODULE_PATH and CHROMIUM_PATH, run Vite with fake
Supabase values (https://supabase.test / test-anon), then run tests/communities-browser.mjs
(port 5175 by default, configurable with TEST_ORIGIN) and tests/chat-settings-browser.mjs (5173).
Browser mocks and parsing do not establish production RLS/succession behavior. Live multi-user
acceptance and all deferred Prompt 09 checks remain for the developer's later verification prompt.

## Production application and verification

The developer confirmed successful manual application of the complete 0014 migration through
Supabase SQL Editor. Read-only catalog verification against lmzbaxlojgsdwgcxkmzx then passed:

- All eight requested RPCs are present.
- All eight use SECURITY DEFINER and an empty search_path.
- All eight allow authenticated execution and deny anonymous execution.
- community_members_after_delete is enabled AFTER DELETE on public.community_members.
- profiles_before_delete_community_succession is enabled BEFORE DELETE on public.profiles.

Supabase CLI 2.121.0 and the saved CLI login supplied the read-only verification. The process
and .env.local have no SUPABASE_ACCESS_TOKEN; a service-role key is present in .env.local.
No credential values were printed or changed. The agent did not apply the migration or repair
migration history.

The pre-application remote ledger recorded 0001–0007 only; 0008–0013 were absent despite their
feature signatures being present. Because 0014 was also applied manually, do not assume a
future db push is safe: reconcile migration history against the deployed schema first.
This implementation did not change that ledger.

Catalog verification establishes installation and grants, not live multi-user behavior.
The next step is the developer's separate Prompt 11 acceptance checklist, including the deferred
Prompt 09 community checks and Prompt 09/10 regression checks. Do not create docs/11-verification.md
or open a PR until explicitly instructed after that verification.

## Full change manifest

### Components

- `src/features/communities/components/CommunitiesList.tsx`
- `src/features/communities/components/CommunityCard.tsx`
- `src/features/communities/components/CommunityChatHeader.tsx`
- `src/features/communities/components/CommunityChatListItem.tsx`
- `src/features/communities/components/CommunityChatSidebar.tsx`
- `src/features/communities/components/CommunityChatView.tsx`
- `src/features/communities/components/CommunityInfoScreen.tsx`
- `src/features/communities/components/CommunitySettingsActions.tsx`
- `src/features/communities/components/CreateCommunityChatModal.tsx`
- `src/features/communities/components/CreateCommunityModal.tsx`
- `src/features/communities/components/CreationDialog.tsx`

### Hooks

- `src/features/communities/hooks/useCommunities.ts`
- `src/features/communities/hooks/useCommunity.ts`
- `src/features/communities/hooks/useCommunityChats.ts`
- `src/features/communities/hooks/useCommunityMembers.ts`
- `src/features/communities/hooks/useCreateCommunity.ts`
- `src/features/communities/hooks/useCreateCommunityChat.ts`
- `src/features/communities/hooks/useDeleteCommunity.ts`
- `src/features/communities/hooks/useLeaveCommunity.ts`
- `src/features/communities/hooks/useMuteCommunity.ts`
- `src/features/communities/hooks/useUpdateCommunityInfo.ts`

### Community types and helpers

- `src/features/communities/lib/cache.ts`
- `src/features/communities/lib/communityActions.ts`
- `src/features/communities/lib/communityApi.ts`
- `src/features/communities/lib/communityDetails.ts`
- `src/features/communities/types.ts`

### Routes

- `src/routes/_authenticated.communities.$communityId.chats.$chatId.tsx`
- `src/routes/_authenticated.communities.$communityId.index.tsx`
- `src/routes/_authenticated.communities.$communityId.info.tsx`
- `src/routes/_authenticated.communities.$communityId.tsx`
- `src/routes/_authenticated.communities.tsx`

### Migration

- `supabase/migrations/0014_communities.sql`

### Tests

- `tests/chat-settings-browser.mjs`
- `tests/communities-browser.mjs`
- `tests/communities.test.ts`

### Shared integrations, styles and dependencies

- `package.json`
- `pnpm-lock.yaml`
- `src/app/connection-banner.tsx`
- `src/app/router.tsx`
- `src/features/chat-settings/components/AddMembersModal.tsx`
- `src/features/chat-settings/components/ChatOptionsMenu.tsx`
- `src/features/chat-settings/components/ChatSettingsLayer.tsx`
- `src/features/chat-settings/components/GroupMembersList.tsx`
- `src/features/chat-settings/components/GroupSettingsScreen.tsx`
- `src/features/chat-settings/components/MuteSubmenu.tsx`
- `src/features/chat-settings/hooks/useAddMembers.ts`
- `src/features/chat-settings/hooks/useGroupMembers.ts`
- `src/features/chat-settings/hooks/useGroupSettings.ts`
- `src/features/chat-settings/lib/cache.ts`
- `src/features/chat-settings/lib/groupAvatar.ts`
- `src/features/chats/components/ChatContextMenu.tsx`
- `src/features/chats/components/MultiSelectToolbar.tsx`
- `src/features/chats/hooks/useChatMutations.ts`
- `src/features/chats/hooks/useChats.ts`
- `src/features/messages/components/ChatHeader.tsx`
- `src/features/messages/hooks/useChat.ts`
- `src/features/messages/hooks/useMarkAsRead.ts`
- `src/features/messages/hooks/useRealtimeMessages.ts`
- `src/routes/_authenticated.chats.$chatId.tsx`
- `src/routes/_authenticated.chats.tsx`
- `src/styles/communities.css`
- `src/types/database.ts`

### Documentation

- `docs/communities.md` (this implementation record)
