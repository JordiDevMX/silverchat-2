# Graph Report - silverchat  (2026-11-12)

## Corpus Check
- 494 files · ~314,083 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 20 file(s) not represented in the graph (top: .css 10, (none) 6, .example 1)

## Summary
- 2222 nodes · 6860 edges · 120 communities (83 shown, 37 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a5c86867`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Button
- App Navigation & Chat Menus
- cn
- Initial Postgres Database Schema
- Netlify Auth BFF Serverless Functions
- router.tsx
- MessageActionsProvider.tsx
- messages/types.ts
- Database Business Logic Triggers
- ChannelInfoScreen.tsx
- Conversation Timeline & Bubbles
- Message Actions Browser Tests
- useMessages.ts
- Chat Settings Browser Tests
- message-actions.test.ts
- Chat Picker & Creation Hooks
- Package DevDependencies Config
- Biome Linter & Formatter Config
- Package Runtime Dependencies
- useGroupSettings.ts
- Novedades Browser Test Suite
- _authenticated.chats.$chatId.tsx
- theme-provider.tsx
- StoryViewer.tsx
- @tanstack/react-router
- Composer.tsx
- Messages Browser Test Suite
- Row Level Security Policies
- Communities SQL Schema & RPCs
- NavLink
- verify-migrations.mjs
- Communities, Calls & PWA Roadmap
- devDependencies
- utils.ts
- App TypeScript Compiler Config
- Button
- lib/auth-provider.tsx
- Stories & Channels SQL Migration
- database.ts
- db-guard.test.ts
- Chats List Browser Test Suite
- useCreateChannelDialog.ts
- Foundations, Stack & Schema Roadmap
- lib/auth-provider.tsx
- Communities Browser Test Suite
- NPM Package Scripts
- SilverChat UI Foundation Specification
- Netlify Functions TypeScript Config
- Node Tooling TypeScript Config
- Application HTML Entry (index.html)
- Module 6A — Chat List, Creation and Final Migration Evidence
- Message Actions SQL Migration
- Feature Architecture & Verification Docs
- SharedMediaView.tsx
- I18n & Theme System Roadmap
- Profile Settings & Block SQL Migration
- messages/types.ts
- 20261111103000_backfill_profile_settings.sql
- @tanstack/react-router
- Messages Enhancements SQL Migration
- PIF Shared Memory — Operating Protocol v1.0
- Migration equivalence report — 2026-11-11
- Profile & Account Deletion Roadmap
- Chat Layout & Media Upload Roadmap
- App.tsx
- novedades-concurrency.mjs
- Profile Docs & Migration Reports
- Novedades pgTAP SQL Tests
- Contact Profile & Group Admin Roadmap
- TOTP Backup Codes SQL Migration
- Profile Settings pgTAP SQL Tests
- Stories & Broadcast Channels Roadmap
- Message Actions & Voice Notes Roadmap
- Chats List & Message Requests Roadmap
- Chat Delete & Read State SQL RPCs
- Story Viewers Optimization SQL
- Auth BFF Browser Test Suite
- Query Storm & Story Burst Fix Docs
- Authentication pgTAP SQL Tests
- Backend Foundation pgTAP SQL Tests
- UI Migration Closeout Policy
- POSIX Supabase Setup Script
- Vite Environment Type Declarations
- Device Fingerprint Index Migration
- Root TypeScript Project References
- components.tsx
- Authentication & AAL2 MFA Docs
- Migration equivalence verification
- public/manifest.json
- manifest.json
- Engineer → Guardian Delivery Submission
- PIF Session Handoff
- Engineer → Guardian Delivery Submission
- Project Baseline
- generate-og-image.mjs
- Evidence Index
- CreateCommunityChatModal.tsx
- Bidirectional Traceability Register
- decisions/README.md
- handoffs/README.md
- changes.md
- inbox/README.md
- _authenticated.tsx
- Standalone Visual Review Server (pnpm review:ui)

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 204 edges
2. `react` - 167 edges
3. `useMessageText()` - 157 edges
4. `Button` - 145 edges
5. `cn()` - 81 edges
6. `supabase` - 78 edges
7. `@tanstack/react-query` - 73 edges
8. `lucide-react` - 70 edges
9. `useI18n()` - 67 edges
10. `Avatar()` - 58 edges

## Surprising Connections (you probably didn't know these)
- `Findings — Production differed from the migration files (12 objects, all 0005/0006) — RESOLVED` --references--> `authenticated()`  [INFERRED]
  .pif/inbox/TASK-012-delivery.md → netlify/functions/_lib/supabase-admin.ts
- `Open questions` --references--> `I18nProvider()`  [INFERRED]
  .pif/requirements.md → src/app/providers/i18n-provider.tsx
- `Requirements Register` --references--> `useChats()`  [INFERRED]
  .pif/requirements.md → src/features/chats/hooks/useChats.ts
- `Requirements Register` --references--> `useMessageRequests()`  [INFERRED]
  .pif/requirements.md → src/features/chats/hooks/useMessageRequests.ts
- `Requirements Register` --references--> `useStorageUsage()`  [INFERRED]
  .pif/requirements.md → src/features/settings/hooks.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Chat Read Receipt & Unread State Lifecycle** — roadmap_06_profile_settings_privacy_visibility, roadmap_07_chats_list_manually_unread, roadmap_07_chats_list_use_chats, roadmap_08a_chat_layout_messages_auto_mark_read [EXTRACTED 1.00]
- **Client-Side Media Optimization & Storage Upload Pipeline** — roadmap_06_profile_settings_avatar_upload, roadmap_08a_chat_layout_messages_media_upload_flow, roadmap_08b_message_actions_voice_notes, roadmap_09_contact_profile_chat_settings_shared_media_view, roadmap_10_novedades_stories_channels_story_creator [EXTRACTED 1.00]
- **AAL2 MFA-Gated Security Definer RPCs and Privacy Views Across All Feature Domains** — docs_authentication_aal2_mfa_contract, docs_chats_list_architecture, docs_chat_settings_architecture, docs_communities_architecture, docs_novedades_architecture [EXTRACTED 1.00]
- **Novedades Query Storm & Signed Media URL Burst Resilience Architecture** — docs_query_storm_fix_doc, docs_query_storm_fix_novedades_query_storm_mitigation, docs_query_storm_fix_supabase_health_circuit_breaker, docs_story_media_burst_fix_doc, docs_story_media_burst_fix_lazy_jittered_media_signing, docs_story_media_burst_fix_get_story_viewers_optimization [EXTRACTED 1.00]
- **Production Deployment, Security Headers, Health Checks & Sentry Observability** — roadmap_16_deployment_metadata_sentry_monitoring, roadmap_16_deployment_metadata_ci_netlify_config, roadmap_16_deployment_metadata_health_endpoints, roadmap_16_deployment_metadata_deploy_fase2_docs [EXTRACTED 1.00]
- **Real-Time Voice/Video Call Signaling, LiveKit Media & Push Notification Flow** — roadmap_12_calls_migration_0013, roadmap_12_calls_livekit_token_edge_function, roadmap_12_calls_call_state_machine, roadmap_12_calls_use_livekit_room, roadmap_13_pwa_offline_web_push_pipeline [EXTRACTED 1.00]
- **Cross-Device Preference Persistence & FOUC-Free Boot Flow** — roadmap_14_i18n_theme_fouc_prevention_script, roadmap_14_i18n_theme_theme_lib, roadmap_14_i18n_theme_use_theme, roadmap_14_i18n_theme_use_language, roadmap_14_i18n_theme_dual_persistence_pattern [EXTRACTED 1.00]
- **Type-Safe Multi-Namespace i18next Architecture** — roadmap_14_i18n_theme_i18n_lib, roadmap_14_i18n_theme_i18n_types, roadmap_14_i18n_theme_i18n_provider, roadmap_14_i18n_theme_locale_namespaces, roadmap_14_i18n_theme_use_formatters [EXTRACTED 1.00]
- **SilverChat Tailwind v4 OKLCH Three-Layer Theme Cascade & Glass/Motion System** — roadmap_03_design_system_three_layer_token_cascade, roadmap_03_design_system_tailwind_v4_theme_inline_bridge, roadmap_03_design_system_glassmorphism_and_motion_system [EXTRACTED 1.00]
- **SPA + Netlify BFF Magic-Link, HttpOnly Refresh Cookie & TOTP/Backup-Code Auth Flow** — roadmap_04a_data_model_entities_handle_new_user_trigger, roadmap_05_authentication_netlify_bff_cookie_architecture, roadmap_05_authentication_client_auth_and_protected_routes, roadmap_05_authentication_totp_2fa_and_backup_codes [EXTRACTED 1.00]
- **Supabase Backend Schema, Staging Migrations, and Profile/Settings Lifecycle** — supabase_readme_doc, supabase_readme_backend_schema_and_rls, docs_staging_migrations_report_doc, docs_staging_migrations_report_crlf_migration_guard, docs_profile_settings_doc, docs_profile_settings_cleanup_deleted_accounts [EXTRACTED 1.00]
- **Supabase Postgres Schema, RLS Policies, Privacy View & SECURITY DEFINER RPCs** — roadmap_04a_data_model_entities_postgres_schema, roadmap_04a_data_model_entities_unified_chats_and_messages, roadmap_04b1_rls_policies_rls_security_model, roadmap_04b1_rls_policies_profiles_visible_view, roadmap_04b2_business_logic_rpc_business_triggers, roadmap_04b2_business_logic_rpc_security_definer_rpcs [EXTRACTED 1.00]
- **Unified Message Rendering, Composer & Actions Pipeline** — roadmap_08a_chat_layout_messages_message_list_scroll, roadmap_08a_chat_layout_messages_message_bubble_grouping, roadmap_08a_chat_layout_messages_composer, roadmap_08b_message_actions_action_matrix, roadmap_08b_message_actions_reply_forward_edit_delete, roadmap_10_novedades_stories_channels_channel_view [EXTRACTED 1.00]
- **PWA Caching, IndexedDB Outbox & Device Push Subscription Lifecycle** — roadmap_13_pwa_offline_workbox_caching, roadmap_13_pwa_offline_indexeddb_outbox, roadmap_13_pwa_offline_web_push_pipeline, roadmap_15_privacy_security_auth_logout_all [INFERRED 0.85]

## Communities (120 total, 37 thin omitted)

### Community 0 - "Button"
Cohesion: 0.06
Nodes (94): browser-image-compression, react, react-easy-crop, I18nContext, spanish, useI18n(), useTheme(), PublicProfileSurface() (+86 more)

### Community 1 - "App Navigation & Chat Menus"
Cohesion: 0.07
Nodes (57): Badge, BadgeProps, badgeVariants, BrandLockup(), BrandMark(), FloatingActionButton(), icons, AppNavigation() (+49 more)

### Community 2 - "cn"
Cohesion: 0.10
Nodes (32): class-variance-authority, @radix-ui/react-dialog, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, DialogContent (+24 more)

### Community 3 - "Initial Postgres Database Schema"
Cohesion: 0.07
Nodes (64): app_config_set_updated_at, channels_set_updated_at, chats_set_updated_at, communities_set_updated_at, idx_calls_chat, idx_calls_initiator, idx_calls_ringing, idx_channel_followers_user (+56 more)

### Community 4 - "Netlify Auth BFF Serverless Functions"
Cohesion: 0.06
Nodes (66): allowAttempt(), attempts, handler(), schema, handler(), handler(), handler(), schema (+58 more)

### Community 5 - "router.tsx"
Cohesion: 0.10
Nodes (24): authenticated, AuthenticatedDestination(), CheckEmailPage, communityChildren, LoginPage, PickUsernamePage, PostLoginPage, protectedRoutes (+16 more)

### Community 6 - "MessageActionsProvider.tsx"
Cohesion: 0.21
Nodes (13): Textarea, EditMessageModal(), Context, MessageActionsProvider(), actionIcons, MessageContextMenu(), useEditMessageDialog(), UI (+5 more)

### Community 7 - "messages/types.ts"
Cohesion: 0.18
Nodes (25): SharedMediaTileSurface(), StoryCardSurface(), SharedMediaTab(), Tile(), AudioMessage(), DownloadButton(), ImageMessage(), StickerMessage() (+17 more)

### Community 8 - "Database Business Logic Triggers"
Cohesion: 0.07
Nodes (20): channel_followers_after_delete, channel_followers_after_insert, chat_members_after_delete, community_members_after_delete, community_members_after_insert, idx_channels_last_message, messages_after_insert, messages_after_update (+12 more)

### Community 9 - "ChannelInfoScreen.tsx"
Cohesion: 0.16
Nodes (22): ChannelInfoSurface(), SettingsRow(), ChannelComposer(), ChannelHeader(), ChannelInfoScreen(), EditFields(), ChannelView(), useChannelDeletion() (+14 more)

### Community 10 - "Conversation Timeline & Bubbles"
Cohesion: 0.16
Nodes (19): BubbleSurface(), MessageSurface(), ReactionChip(), TimelineDate(), TimelineUnread(), ReplySurface(), DateSeparator(), useMessageActionUI() (+11 more)

### Community 11 - "Message Actions Browser Tests"
Cohesion: 0.07
Nodes (34): ago(), bubble(), channels, chat(), chatId, errors, forwardCalls, goto() (+26 more)

### Community 12 - "useMessages.ts"
Cohesion: 0.20
Nodes (18): useSharedMedia(), useRequestMutation(), useConversationController(), useInChatSearch(), Action, useMessageActions(), enrichMessages(), useMessages() (+10 more)

### Community 13 - "Chat Settings Browser Tests"
Cohesion: 0.07
Nodes (32): ago(), channels, chat(), chatId, errors, fileRows, goto(), groupId (+24 more)

### Community 14 - "message-actions.test.ts"
Cohesion: 0.14
Nodes (19): zustand, VoiceWaveform(), VoicePlayer(), VoiceRecorder(), useMediaSend(), useUploadProgress(), useVoicePlayback(), Recording (+11 more)

### Community 15 - "Chat Picker & Creation Hooks"
Cohesion: 0.17
Nodes (21): Skeleton(), ChatContactRow(), ChatListSkeleton(), useCreateDirectChat(), CreateGroupChatInput, formatGroupChatError(), useCreateGroupChat(), validateGroupChatInput() (+13 more)

### Community 16 - "Package DevDependencies Config"
Cohesion: 0.07
Nodes (27): name, private, type, version, @biomejs/biome, linkifyjs, @marsidev/react-turnstile, @radix-ui/react-dropdown-menu (+19 more)

### Community 17 - "Biome Linter & Formatter Config"
Cohesion: 0.06
Nodes (30): source, assist, actions, noUnusedImports, noUnusedVariables, css, parser, files (+22 more)

### Community 18 - "Package Runtime Dependencies"
Cohesion: 0.06
Nodes (31): dependencies, browser-image-compression, class-variance-authority, clsx, focus-trap-react, @fontsource-variable/inter, frimousse, @hookform/resolvers (+23 more)

### Community 19 - "useGroupSettings.ts"
Cohesion: 0.39
Nodes (7): useClearChat(), useGroupMembers(), useGroupSettings(), useLeaveGroup(), refreshChatSettings(), writeDraft(), useCommunityMembers()

### Community 20 - "Novedades Browser Test Suite"
Cohesion: 0.08
Nodes (28): channels, direct, errors, followed, follows, goto(), longClip, me (+20 more)

### Community 21 - "_authenticated.chats.$chatId.tsx"
Cohesion: 0.22
Nodes (9): ConversationHeaderSurface(), CommunityChatHeader(), CommunityChatView(), ChatHeader(), InChatSearch(), PinnedMessagesBar(), ChatPage(), Conversation() (+1 more)

### Community 22 - "theme-provider.tsx"
Cohesion: 0.08
Nodes (24): Open questions, Requirements Register, Approved scope changes, Milestones, Roadmap, Active / blocked tasks, Current focus, Current Project State (+16 more)

### Community 23 - "StoryViewer.tsx"
Cohesion: 0.13
Nodes (22): StoryProgressSurface(), StoryReplySurface(), StoryStageSurface(), StoriesRow(), StoryProgressBar(), StoryReplyInput(), Segment(), StoryViewer() (+14 more)

### Community 24 - "@tanstack/react-router"
Cohesion: 0.24
Nodes (16): useDestinationActions(), useAddMembers(), useCommunityChats(), useCommunitySettingsActions(), useCreateCommunity(), useCreateCommunityChat(), useCreateCommunityDialog(), useDeleteCommunity() (+8 more)

### Community 25 - "Composer.tsx"
Cohesion: 0.19
Nodes (13): frimousse, ComposerDock(), quickReactionEmoji, QuickReactions(), AttachmentMenu(), Composer(), EmojiPanel, EmojiPanel() (+5 more)

### Community 26 - "Messages Browser Test Suite"
Cohesion: 0.09
Nodes (25): ago(), channels, chat(), chatId, errors, goto(), groupId, groupRows (+17 more)

### Community 27 - "Row Level Security Policies"
Cohesion: 0.09
Nodes (15): messages_before_update_guard, public.can_view_avatar(), public.can_view_story(), public.has_read_receipts_enabled(), public.is_blocked(), public.is_blocked_either_way(), public.is_channel_follower(), public.is_channel_owner() (+7 more)

### Community 28 - "Communities SQL Schema & RPCs"
Cohesion: 0.09
Nodes (5): community_members_after_delete, community_members_after_role_update, profiles_before_delete_community_succession, public.create_community(), public.handle_profile_deletion_community_succession()

### Community 29 - "NavLink"
Cohesion: 0.09
Nodes (43): ChatMenuSurface(), ChatSettingsDialog(), ChatSettingsScreenSurface(), MemberRowSurface(), CardSurface(), AddMembersModal(), ChatOptionsMenu(), MenuProps (+35 more)

### Community 30 - "verify-migrations.mjs"
Cohesion: 0.10
Nodes (38): canonExpr(), canonExprLoose(), intervalSeconds(), LITERAL_PATTERN, matchParen(), relNames(), DUMP_JSON, DUMP_SQL (+30 more)

### Community 31 - "Communities, Calls & PWA Roadmap"
Cohesion: 0.11
Nodes (15): CommunityCard & Collapsible Chat Preview, Migration 0012_communities.sql, Roadmap #11: Communities Specification, Edge Function: livekit-token, Migration 0013_calls_enhancements.sql & start_call RPC, Roadmap #12: Calls (Voice & Video) Specification, useLiveKitRoom Hook & Active Call Modals, Roadmap #13: PWA, Offline & Push Notifications Specification (+7 more)

### Community 32 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, @biomejs/biome, @netlify/functions, supabase, tailwindcss, @tailwindcss/vite, @tanstack/devtools-vite, @tanstack/react-devtools (+7 more)

### Community 33 - "utils.ts"
Cohesion: 0.12
Nodes (11): clsx, @radix-ui/react-hover-card, @radix-ui/react-popover, @radix-ui/react-separator, tailwind-merge, Avatar(), sizes, HoverCardContent (+3 more)

### Community 34 - "App TypeScript Compiler Config"
Cohesion: 0.08
Nodes (23): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+15 more)

### Community 35 - "Button"
Cohesion: 0.10
Nodes (33): lucide-react, SecurityPage, BackupCodesSurface(), Button, ButtonProps, buttonVariants, ChannelFollowButton(), ChannelRowContent() (+25 more)

### Community 36 - "lib/auth-provider.tsx"
Cohesion: 0.08
Nodes (34): generateBackupCodes(), AuthState, Profile, RefreshBody, SessionPayload, Action, useSecuritySettings(), authApi() (+26 more)

### Community 37 - "Stories & Channels SQL Migration"
Cohesion: 0.11
Nodes (8): idx_messages_channel_cursor, idx_messages_reply_to_story, idx_stories_active, idx_stories_thumbnail, messages_validate_novedades, public.get_story_viewers(), public.set_message_reaction(), public.update_channel_info()

### Community 38 - "database.ts"
Cohesion: 0.12
Nodes (24): communityLayout, CommunityCardSurface(), CommunityChatRowContent(), SearchField(), CommunitiesList(), CommunityCard(), CommunityChatListItem(), CommunityChatSidebar() (+16 more)

### Community 39 - "db-guard.test.ts"
Cohesion: 0.20
Nodes (10): Independent review, evaluate(), findCrlfMigrations(), KNOWN_REFS, parseArgs(), PRODUCTION_REF, readProjectRef(), repoRoot() (+2 more)

### Community 40 - "Chats List Browser Test Suite"
Cohesion: 0.14
Nodes (19): ago(), creationCalls, errors, fulfill(), liveConfig, membership(), memberships, menu() (+11 more)

### Community 41 - "useCreateChannelDialog.ts"
Cohesion: 0.22
Nodes (12): saveGroupAvatar(), cleanupUploads(), prepareAndUpload(), safeFilename(), uploadToStorage(), videoThumbnail(), Upload, useCreateChannel() (+4 more)

### Community 42 - "Foundations, Stack & Schema Roadmap"
Cohesion: 0.11
Nodes (14): LiveKit Token Generation Edge Function, SilverChat Infrastructure Stack, Frontend SPA Tech Stack (Vite 6 + React 19 + TypeScript Strict), Supabase Typed Client (src/lib/supabase.ts), Glassmorphism (.glass-surface) & Motion Tokens, handle_new_user() Auth Onboarding Trigger, SilverChat 21-Table Postgres Schema (0001_initial_schema.sql), profiles_visible Column-Level Privacy View (+6 more)

### Community 43 - "lib/auth-provider.tsx"
Cohesion: 0.17
Nodes (19): @supabase/supabase-js, @tanstack/react-query, useChatSettingsLayer(), allRows(), chunks(), CreateDirectChatInput, useMessageRequests(), useCommunities() (+11 more)

### Community 44 - "Communities Browser Test Suite"
Cohesion: 0.13
Nodes (18): calls, chat(), chats, cid, errors, general, me, member() (+10 more)

### Community 45 - "NPM Package Scripts"
Cohesion: 0.12
Nodes (17): scripts, build, db:types, dev, lint, lint:fix, preinstall, preview (+9 more)

### Community 47 - "Netlify Functions TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess, noUnusedLocals (+8 more)

### Community 48 - "Node Tooling TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 50 - "Module 6A — Chat List, Creation and Final Migration Evidence"
Cohesion: 0.33
Nodes (4): CSS Consumer Inventory — Module 6A, Historical UI Migration Closeout — Module 5C / TASK-006, Module 6A — Chat List, Creation and Final Migration Evidence, Voice Playback Contract Test Fixture HTML (tests/voice-player.html)

### Community 51 - "Message Actions SQL Migration"
Cohesion: 0.16
Nodes (4): idx_messages_forwarded_from, messages_pin_limit, messages_validate_edit, public.can_access_chat_message()

### Community 52 - "Feature Architecture & Verification Docs"
Cohesion: 0.20
Nodes (13): Prompt 09 Contact Profile & Chat Settings Verification Report, Prompt 08b Message Actions Verification Report, Contact Profiles, Group Admin RPCs & Shared Media (Prompt 09 / Migration 0011), Active Chats List, Filters, Requests & Local Drafts (Prompt 07 / Migration 0007), Communities Hierarchy, Succession & Shared Conversation (Prompt 11 / Migration 0014), Hardened Message Actions & Exclusive Voice Notes (Prompt 08b / Migration 0010), Conversation History, Optimistic Outbox & Private Media (Prompt 08a / Migration 0008), New Direct Chat & New Group Creation Flows (Prompt 07 Gap Fix) (+5 more)

### Community 53 - "SharedMediaView.tsx"
Cohesion: 0.22
Nodes (14): SharedFileRowSurface(), FileIconTile(), icons, FileRow(), SharedFilesTab(), useSharedFileDownload(), FileMessage(), MediaPreviewModal() (+6 more)

### Community 54 - "I18n & Theme System Roadmap"
Cohesion: 0.18
Nodes (12): src/features/settings/components/AppearanceScreen.tsx, src/lib/i18n.ts (i18next Configuration), src/app/providers/I18nProvider.tsx, src/types/i18n.d.ts (TypeScript i18next Definitions), 18 Locale JSON Files (9 Namespaces x en/es), src/app/main.tsx (Entry Point i18n Initialization), Prompt #14: Internationalization & Theme System Specification, src/lib/theme.ts (Theme & Accent Helpers) (+4 more)

### Community 55 - "Profile Settings & Block SQL Migration"
Cohesion: 0.18
Nodes (6): idx_devices_fingerprint, idx_profiles_pending_deletion, messages_block_check, profiles_username_change_validation, public.profiles_blocked, public.profiles_visible

### Community 56 - "messages/types.ts"
Cohesion: 0.15
Nodes (20): linkify-react, createDraftWriter(), ContactMessage(), LocationMessage(), SystemMessage(), TextMessage(), MessageContent(), useComposerController() (+12 more)

### Community 57 - "20261111103000_backfill_profile_settings.sql"
Cohesion: 0.19
Nodes (7): idx_profiles_pending_deletion, messages_block_check, profiles_username_change_validation, public.check_blocked_on_message_insert(), public.profiles_blocked, public.profiles_visible, public.validate_username_change()

### Community 58 - "@tanstack/react-router"
Cohesion: 0.18
Nodes (20): @hookform/resolvers, react-hook-form, @tanstack/react-router, AuthErrorPage, useCheckEmail(), useEmailForm(), useMfaVerification(), useOnboardingWelcome() (+12 more)

### Community 59 - "Messages Enhancements SQL Migration"
Cohesion: 0.25
Nodes (5): idx_messages_chat, idx_messages_mentions, idx_messages_thumbnail, messages_validate_media_mentions, public.validate_message_media_mentions()

### Community 60 - "PIF Shared Memory — Operating Protocol v1.0"
Cohesion: 0.13
Nodes (14): 10. Recovery, 11. Stop conditions, 12. Language, 1. Roles, 2. Canonical files and minimalism, 3. Claim classification, 4. Record and link conventions, 5. Controlled update transaction (+6 more)

### Community 61 - "Migration equivalence report — 2026-11-11"
Cohesion: 0.22
Nodes (8): Differences proven to be presentational, Ledger, Migration equivalence report — 2026-11-11, Production — 12 findings (resolved by the corrective migration), Reconciliation (2026-11-11, later the same day), Scope of the comparison, Summary, Why 0005 is missing on Production

### Community 62 - "Profile & Account Deletion Roadmap"
Cohesion: 0.20
Nodes (6): Device Fingerprinting & Session Management (devices.ts), Prompt #6: Profile & User Settings Specification, Migration 0005: Profile Settings & Block Enforcement Triggers, Migration 0006: Account Deletion RPCs (schedule_account_deletion / cancel_account_deletion), Social Links Normalization (social-links.ts), ChatContextMenu, MultiSelectToolbar & SwipeActions

### Community 63 - "Chat Layout & Media Upload Roadmap"
Cohesion: 0.20
Nodes (5): Composer, Lazy Emoji Picker (frimousse) & @Mention Autocomplete, Prompt #8a: Chat Layout, Message Rendering & Composer Specification, MessageBubble & Consecutive Message Grouping (groupMessages.ts), MessageContent Dispatcher & 9 Content Subtypes, Migration 0008: Message Mentions GIN Index & Profiles Realtime

### Community 64 - "App.tsx"
Cohesion: 0.17
Nodes (18): App(), AuthenticatedRouter(), queryClient, ConnectionBanner(), LandingPage, router, AuthCard(), AuthSurface() (+10 more)

### Community 65 - "novedades-concurrency.mjs"
Cohesion: 0.33
Nodes (4): args, clean(), dockerProbe, sql()

### Community 66 - "Profile Docs & Migration Reports"
Cohesion: 0.25
Nodes (5): cleanup-deleted-accounts Scheduled Function, Profile and Settings (Prompt 06), Staging Migrations Run Report, Test Users Provisioning Guide, SilverChat Backend Foundation README

### Community 68 - "Contact Profile & Group Admin Roadmap"
Cohesion: 0.22
Nodes (8): Client-Side WebP Avatar Upload & Crop Flow (avatar-upload.ts / AvatarPickerModal), ContactProfileModal (useContactProfile), Prompt #9: Contact Profile & Chat Settings Specification, GroupMembersList, AddMembersModal & GroupSettingsScreen, Migration 0010: Group Admin RPCs, Clear Chat & Shared Media Indexes, ReportModal, LeaveGroupModal & ClearChatModal, SharedMediaView (SharedMediaTab & SharedFilesTab), ChannelView, ChannelHeader & ChannelInfoScreen

### Community 69 - "TOTP Backup Codes SQL Migration"
Cohesion: 0.29
Nodes (3): idx_backup_codes_user_unused, public.auth_mfa_satisfied(), public.two_factor_backup_codes

### Community 71 - "Stories & Broadcast Channels Roadmap"
Cohesion: 0.25
Nodes (7): ChatListItem & WhatsApp-Style Checkmarks, ChannelsSection, DiscoverChannelsSection & CreateChannelModal, Prompt #10: Novedades (Stories & Channels) Specification, Migration 0011: Stories & Channels RPCs and Schema Additions, StoriesRow, StoryCard & Story Ordering (storyOrdering.ts), StoryCreator & StoryTextEditor (storyColors.ts), StoryViewer, useStoryTimer & StoryReplyInput

### Community 72 - "Message Actions & Voice Notes Roadmap"
Cohesion: 0.32
Nodes (7): ChatFilters & Scoped Local Search Pipeline, MessageContextMenu & useMessageActions Hook, Prompt #8b: Message Actions & Voice Notes Specification, InChatSearch & PinnedMessagesBar (useInChatSearch / usePinnedMessages), Migration 0009: Voice Peaks, Forward Tracking & 3-Pin Limit Trigger, ReactionsPicker & ReactionsDisplay (useReactions), Chat Action Availability Matrix & ChatOptionsMenu (chatActions.ts)

### Community 73 - "Chats List & Message Requests Roadmap"
Cohesion: 0.25
Nodes (5): Prompt #7: Chats List Specification, MessageRequestsSection (Accept & 7-Day Cooldown Decline), Migration 0007: Chat Delete Adjustments & Read/Unread RPCs, useChats, useMessageRequests & Realtime Subscriptions, ReplyPreview, ForwardModal, EditMessageModal & DeleteMessageModal

### Community 77 - "Auth BFF Browser Test Suite"
Cohesion: 0.33
Nodes (5): failures, fulfill(), jwt(), session(), storedHashes

### Community 78 - "Query Storm & Story Burst Fix Docs"
Cohesion: 0.47
Nodes (3): Novedades Query Storm Fix Report, Supabase Health Outage Detection and Recovery Probe, Story Media Signed URL Burst & Slow get_story_viewers Fix Report

### Community 93 - "components.tsx"
Cohesion: 0.18
Nodes (12): MfaVerifyPage, CodeInput(), Input, Modal(), modalStack, SessionExpiredModal(), ContactPicker(), DeleteMessageModal() (+4 more)

### Community 100 - "Migration equivalence verification"
Cohesion: 0.29
Nodes (6): Guarantees, Migration equivalence verification, Probes, Reading the report, Usage, What is compared

### Community 101 - "public/manifest.json"
Cohesion: 0.13
Nodes (14): background_color, description, dir, display, display_override, icons, id, lang (+6 more)

### Community 102 - "manifest.json"
Cohesion: 0.15
Nodes (12): approval_authority, baseline_revision, baseline_status, documentation_language, governance_owner, implementation_owner, last_reconciled_revision, note (+4 more)

### Community 104 - "Engineer → Guardian Delivery Submission"
Cohesion: 0.14
Nodes (13): Changes made, Checks and evidence, Database-side changes (authorized), Engineer → Guardian Delivery Submission, Findings — Production differed from the migration files (12 objects, all 0005/0006) — RESOLVED, Human verification needed, Reconciliation — new files, Requested behavior and scope (+5 more)

### Community 105 - "PIF Session Handoff"
Cohesion: 0.22
Nodes (8): Active task and exact revision, Approved objective and scope, Blocking issues / pending approvals, Gate states and evidence, Last independently verified milestone, Latest source records, Next authorized action, PIF Session Handoff

### Community 107 - "Engineer → Guardian Delivery Submission"
Cohesion: 0.25
Nodes (7): Changes made, Checks and evidence, Engineer → Guardian Delivery Submission, Human verification needed, Requested behavior and scope, Requested Guardian action, Risks / open gates

### Community 108 - "Project Baseline"
Cohesion: 0.25
Nodes (7): Approvals, Constraints and non-goals, Definition of Success, Goals, Problem and purpose, Project Baseline, Scope

### Community 110 - "generate-og-image.mjs"
Cohesion: 0.18
Nodes (9): BADGE, buildHtml(), chrome, CHROME_CANDIDATES, FONT, OUTPUT, ROOT, toDataUri() (+1 more)

### Community 112 - "CreateCommunityChatModal.tsx"
Cohesion: 0.48
Nodes (4): focus-trap-react, CreateCommunityChatModal(), CreationDialog(), useCreateCommunityChatDialog()

### Community 118 - "_authenticated.tsx"
Cohesion: 0.52
Nodes (4): AppSkeleton(), ShellBackdrop(), PendingDeletionBanner(), AuthenticatedLayout()

## Knowledge Gaps
- **52 isolated node(s):** `linkifyjs`, `tw-animate-css`, `@biomejs/biome`, `@types/node`, `@types/react` (+47 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 707 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Button` to `App Navigation & Chat Menus`, `cn`, `router.tsx`, `MessageActionsProvider.tsx`, `messages/types.ts`, `ChannelInfoScreen.tsx`, `Conversation Timeline & Bubbles`, `useMessages.ts`, `message-actions.test.ts`, `Chat Picker & Creation Hooks`, `Package DevDependencies Config`, `_authenticated.chats.$chatId.tsx`, `theme-provider.tsx`, `StoryViewer.tsx`, `@tanstack/react-router`, `Composer.tsx`, `NavLink`, `utils.ts`, `Button`, `lib/auth-provider.tsx`, `database.ts`, `useCreateChannelDialog.ts`, `lib/auth-provider.tsx`, `SharedMediaView.tsx`, `messages/types.ts`, `@tanstack/react-router`, `App.tsx`, `components.tsx`, `CreateCommunityChatModal.tsx`, `_authenticated.tsx`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **What connects `linkifyjs`, `tw-animate-css`, `@biomejs/biome` to the rest of the system?**
  _52 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Button` be split into smaller, more focused modules?**
  _Cohesion score 0.05850150279089738 - nodes in this community are weakly interconnected._
- **Why does `useAuth()` connect `@tanstack/react-router` to `Button`, `App Navigation & Chat Menus`, `MessageActionsProvider.tsx`, `messages/types.ts`, `ChannelInfoScreen.tsx`, `Conversation Timeline & Bubbles`, `useMessages.ts`, `message-actions.test.ts`, `Chat Picker & Creation Hooks`, `useGroupSettings.ts`, `StoryViewer.tsx`, `NavLink`, `lib/auth-provider.tsx`, `database.ts`, `useCreateChannelDialog.ts`, `lib/auth-provider.tsx`, `messages/types.ts`, `@tanstack/react-router`, `App.tsx`, `components.tsx`, `_authenticated.tsx`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `App Navigation & Chat Menus` be split into smaller, more focused modules?**
  _Cohesion score 0.07196627521830774 - nodes in this community are weakly interconnected._
- **Why does `Button` connect `Button` to `App.tsx`, `Button`, `cn`, `App Navigation & Chat Menus`, `router.tsx`, `MessageActionsProvider.tsx`, `ChannelInfoScreen.tsx`, `message-actions.test.ts`, `Chat Picker & Creation Hooks`, `CreateCommunityChatModal.tsx`, `NavLink`, `SharedMediaView.tsx`, `_authenticated.tsx`, `StoryViewer.tsx`, `@tanstack/react-router`, `components.tsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.10317460317460317 - nodes in this community are weakly interconnected._