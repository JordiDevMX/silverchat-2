# Graph Report - silverchat  (2026-11-10)

## Corpus Check
- 482 files · ~256,296 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 18 file(s) not represented in the graph (top: .css 10, (none) 6, .example 1)

## Summary
- 2092 nodes · 6649 edges · 118 communities (84 shown, 34 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3afa9907`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useAction
- App Navigation & Chat Menus
- cn
- Initial Postgres Database Schema
- Netlify Auth BFF Serverless Functions
- Button
- MessageActionsProvider.tsx
- messages/types.ts
- Database Business Logic Triggers
- supabase.ts
- Conversation Timeline & Bubbles
- Message Actions Browser Tests
- useMessages.ts
- Chat Settings Browser Tests
- message-actions.test.ts
- Chat Picker & Creation Hooks
- Package DevDependencies Config
- Biome Linter & Formatter Config
- Package Runtime Dependencies
- useAuth
- Novedades Browser Test Suite
- useMessageText
- i18n-provider.tsx
- Avatar
- @tanstack/react-router
- ChannelView.tsx
- Messages Browser Test Suite
- Row Level Security Policies
- Communities SQL Schema & RPCs
- NavLink
- Auth Onboarding & MFA Hooks
- Communities, Calls & PWA Roadmap
- devDependencies
- utils.ts
- App TypeScript Compiler Config
- sheet.tsx
- lib/auth-provider.tsx
- Stories & Channels SQL Migration
- database.ts
- settings-surfaces.tsx
- Chats List Browser Test Suite
- QueryState
- Foundations, Stack & Schema Roadmap
- useChatUIStore
- Communities Browser Test Suite
- NPM Package Scripts
- SilverChat UI Foundation Specification
- Netlify Functions TypeScript Config
- Node Tooling TypeScript Config
- Application HTML Entry (index.html)
- Module 6A — Chat List, Creation and Final Migration Evidence
- Message Actions SQL Migration
- Feature Architecture & Verification Docs
- lucide-react
- I18n & Theme System Roadmap
- Profile Settings & Block SQL Migration
- shared.tsx
- settings.profile.tsx
- hooks.ts
- Messages Enhancements SQL Migration
- PIF Shared Memory — Operating Protocol v1.0
- upload.ts
- Profile & Account Deletion Roadmap
- Chat Layout & Media Upload Roadmap
- App Skeleton & Deletion Banner
- message-actions-concurrency.mjs
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
- UI Migration Closeout & Review Docs
- POSIX Supabase Setup Script
- Vite Environment Type Declarations
- Device Fingerprint Index Migration
- Root TypeScript Project References
- UI Migration Traceability & Contracts
- Authentication & AAL2 MFA Docs
- _authenticated.chats.$chatId.tsx
- SettingsDialog
- manifest.json
- useGroupSettings.ts
- settings-browser.mjs
- PIF Session Handoff
- voice-player.tsx
- Engineer → Guardian Delivery Submission
- Project Baseline
- Current Project State
- Roadmap
- Evidence Index
- Requirements Register
- Bidirectional Traceability Register
- decisions/README.md
- handoffs/README.md
- changes.md
- inbox/README.md

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
- `Application HTML Entry (index.html)` --references--> `SilverChat Brand Favicon SVG (public/favicon.svg)`  [EXTRACTED]
  index.html → public/favicon.svg
- `clearRedirectCookie()` --calls--> `buildSetCookie()`  [EXTRACTED]
  tests/auth-bff.test.ts → netlify/functions/_lib/cookies.ts
- `PlaybackContract()` --calls--> `I18nProvider()`  [EXTRACTED]
  tests/voice-player.tsx → src/app/providers/i18n-provider.tsx
- `PlaybackContract()` --calls--> `VoicePlayer()`  [EXTRACTED]
  tests/voice-player.tsx → src/features/messages/components/VoicePlayer.tsx
- `Voice Playback Contract Test Fixture HTML (tests/voice-player.html)` --conceptually_related_to--> `Module 6A — Chat List, Creation and Final Migration Evidence`  [INFERRED]
  tests/voice-player.html → docs/ui-module-6a.md

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
- **Shared Conversation, Timeline, Composer, and Message Actions Across Direct, Group, Community, and Broadcast Channels** — docs_messages_architecture, docs_message_actions_architecture, docs_communities_architecture, docs_novedades_architecture, ui_migration_map_contract_ledger [EXTRACTED 1.00]
- **SilverChat Tailwind v4 OKLCH Three-Layer Theme Cascade & Glass/Motion System** — roadmap_03_design_system_three_layer_token_cascade, roadmap_03_design_system_tailwind_v4_theme_inline_bridge, roadmap_03_design_system_glassmorphism_and_motion_system [EXTRACTED 1.00]
- **SPA + Netlify BFF Magic-Link, HttpOnly Refresh Cookie & TOTP/Backup-Code Auth Flow** — roadmap_04a_data_model_entities_handle_new_user_trigger, roadmap_05_authentication_netlify_bff_cookie_architecture, roadmap_05_authentication_client_auth_and_protected_routes, roadmap_05_authentication_totp_2fa_and_backup_codes [EXTRACTED 1.00]
- **Supabase Backend Schema, Staging Migrations, and Profile/Settings Lifecycle** — supabase_readme_doc, supabase_readme_backend_schema_and_rls, docs_staging_migrations_report_doc, docs_staging_migrations_report_crlf_migration_guard, docs_profile_settings_doc, docs_profile_settings_cleanup_deleted_accounts [EXTRACTED 1.00]
- **Supabase Postgres Schema, RLS Policies, Privacy View & SECURITY DEFINER RPCs** — roadmap_04a_data_model_entities_postgres_schema, roadmap_04a_data_model_entities_unified_chats_and_messages, roadmap_04b1_rls_policies_rls_security_model, roadmap_04b1_rls_policies_profiles_visible_view, roadmap_04b2_business_logic_rpc_business_triggers, roadmap_04b2_business_logic_rpc_security_definer_rpcs [EXTRACTED 1.00]
- **UI Migration Governance: Step A Hook Extraction, Contract Ledger, and Screenshot-Free Clean Browser Verification** — agents_working_agreements, readme_visual_review_server, ui_migration_map_step_a_extraction_queue, ui_migration_map_contract_ledger, ui_migration_map_modules_1_to_6a [EXTRACTED 1.00]
- **Unified Message Rendering, Composer & Actions Pipeline** — roadmap_08a_chat_layout_messages_message_list_scroll, roadmap_08a_chat_layout_messages_message_bubble_grouping, roadmap_08a_chat_layout_messages_composer, roadmap_08b_message_actions_action_matrix, roadmap_08b_message_actions_reply_forward_edit_delete, roadmap_10_novedades_stories_channels_channel_view [EXTRACTED 1.00]
- **PWA Caching, IndexedDB Outbox & Device Push Subscription Lifecycle** — roadmap_13_pwa_offline_workbox_caching, roadmap_13_pwa_offline_indexeddb_outbox, roadmap_13_pwa_offline_web_push_pipeline, roadmap_15_privacy_security_auth_logout_all [INFERRED 0.85]

## Communities (118 total, 34 thin omitted)

### Community 0 - "useAction"
Cohesion: 0.23
Nodes (14): DisableReadReceiptsModal(), ManageExclusionsModal(), Toggle(), useAction(), useContacts(), useNotificationPreview(), usePreferenceConfirmation(), inAppNotification() (+6 more)

### Community 1 - "App Navigation & Chat Menus"
Cohesion: 0.06
Nodes (62): ChatMenuItem, ChatMenuSurface(), FloatingActionButton(), icons, SearchField(), AppNavigation(), ChatContextMenu(), ChatFilters() (+54 more)

### Community 2 - "cn"
Cohesion: 0.10
Nodes (29): @radix-ui/react-dialog, @radix-ui/react-separator, AuthCard(), Avatar(), sizes, Card, CardContent, CardDescription (+21 more)

### Community 3 - "Initial Postgres Database Schema"
Cohesion: 0.07
Nodes (64): app_config_set_updated_at, channels_set_updated_at, chats_set_updated_at, communities_set_updated_at, idx_calls_chat, idx_calls_initiator, idx_calls_ringing, idx_channel_followers_user (+56 more)

### Community 4 - "Netlify Auth BFF Serverless Functions"
Cohesion: 0.11
Nodes (45): allowAttempt(), attempts, handler(), schema, handler(), handler(), handler(), schema (+37 more)

### Community 5 - "Button"
Cohesion: 0.09
Nodes (44): authenticated, AuthenticatedDestination(), AuthErrorPage, communityChildren, LoginPage, MfaVerifyPage, PickUsernamePage, protectedRoutes (+36 more)

### Community 6 - "MessageActionsProvider.tsx"
Cohesion: 0.19
Nodes (17): react, Textarea, DeleteMessageModal(), EditMessageModal(), ForwardModal(), Context, MessageActionsProvider(), actionIcons (+9 more)

### Community 7 - "messages/types.ts"
Cohesion: 0.13
Nodes (33): SharedMediaTileSurface(), SharedMediaTab(), Tile(), useSharedFileDownload(), AudioMessage(), ContactMessage(), DownloadButton(), ImageMessage() (+25 more)

### Community 8 - "Database Business Logic Triggers"
Cohesion: 0.07
Nodes (20): channel_followers_after_delete, channel_followers_after_insert, chat_members_after_delete, community_members_after_delete, community_members_after_insert, idx_channels_last_message, messages_after_insert, messages_after_update (+12 more)

### Community 9 - "supabase.ts"
Cohesion: 0.16
Nodes (17): @tanstack/react-query, Profile, useChannelDeletion(), useChannelHeaderActions(), useCreateChannel(), useFollowChannel(), useMuteChannel(), useUnfollowChannel() (+9 more)

### Community 10 - "Conversation Timeline & Bubbles"
Cohesion: 0.13
Nodes (23): BubbleSurface(), MessageSurface(), ReactionChip(), TimelineDate(), TimelineUnread(), ReplySurface(), DateSeparator(), useMessageActionUI() (+15 more)

### Community 11 - "Message Actions Browser Tests"
Cohesion: 0.07
Nodes (34): ago(), bubble(), channels, chat(), chatId, errors, forwardCalls, goto() (+26 more)

### Community 12 - "useMessages.ts"
Cohesion: 0.25
Nodes (14): useSharedMedia(), Action, useMessageActions(), enrichMessages(), useMessages(), usePinnedMessages(), useReactions(), invalidateActions() (+6 more)

### Community 13 - "Chat Settings Browser Tests"
Cohesion: 0.07
Nodes (32): ago(), channels, chat(), chatId, errors, fileRows, goto(), groupId (+24 more)

### Community 14 - "message-actions.test.ts"
Cohesion: 0.23
Nodes (9): Recording, useVoiceRecorder(), audioExtension(), audioMimeType(), computePeaks(), recordingLimitMs, AudioStore, useAudioStore (+1 more)

### Community 15 - "Chat Picker & Creation Hooks"
Cohesion: 0.27
Nodes (15): ChatContactRow(), ChatListSkeleton(), useNewChatPage(), MAX_GROUP_MEMBERS, useNewGroupPage(), buildUserSearchOrFilter(), DirectContactItem, escapeIlikePattern() (+7 more)

### Community 16 - "Package DevDependencies Config"
Cohesion: 0.07
Nodes (28): name, private, type, version, @biomejs/biome, linkify-react, linkifyjs, @marsidev/react-turnstile (+20 more)

### Community 17 - "Biome Linter & Formatter Config"
Cohesion: 0.06
Nodes (30): source, assist, actions, noUnusedImports, noUnusedVariables, css, parser, files (+22 more)

### Community 18 - "Package Runtime Dependencies"
Cohesion: 0.06
Nodes (31): dependencies, browser-image-compression, class-variance-authority, clsx, focus-trap-react, @fontsource-variable/inter, frimousse, @hookform/resolvers (+23 more)

### Community 19 - "useAuth"
Cohesion: 0.16
Nodes (23): allRows(), chunks(), fetchChats(), useMessageRequests(), useRequestMutation(), useCommunities(), useCommunityChats(), useCommunityConversation() (+15 more)

### Community 20 - "Novedades Browser Test Suite"
Cohesion: 0.08
Nodes (28): channels, direct, errors, followed, follows, goto(), longClip, me (+20 more)

### Community 21 - "useMessageText"
Cohesion: 0.13
Nodes (22): frimousse, Badge, quickReactionEmoji, QuickReactions(), VoiceWaveform(), EmojiPanel(), pickerComponents, EmojiPanel (+14 more)

### Community 22 - "i18n-provider.tsx"
Cohesion: 0.16
Nodes (18): zustand, App(), AuthenticatedRouter(), queryClient, ConnectionBanner(), I18nContext, I18nProvider(), spanish (+10 more)

### Community 23 - "Avatar"
Cohesion: 0.15
Nodes (21): StoryCardSurface(), StoryProgressSurface(), StoryReplySurface(), StoryStageSurface(), StoryCard(), StoryProgressBar(), StoryReplyInput(), Segment() (+13 more)

### Community 24 - "@tanstack/react-router"
Cohesion: 0.23
Nodes (15): @tanstack/react-router, useAddMembers(), useCommunitySettingsActions(), useCreateCommunity(), useCreateCommunityChat(), useCreateCommunityDialog(), useDeleteCommunity(), useLeaveCommunity() (+7 more)

### Community 25 - "ChannelView.tsx"
Cohesion: 0.19
Nodes (14): ComposerDock(), AttachmentMenu(), Composer(), EmojiPanel, ContactPicker(), InChatSearch(), MentionAutocomplete(), useContactPicker() (+6 more)

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
Cohesion: 0.06
Nodes (65): ChannelFollowButton(), ChannelInfoSurface(), ChannelRowContent(), ChatSettingsDialog(), ChatSettingsScreenSurface(), MemberRowSurface(), Modal(), modalStack (+57 more)

### Community 30 - "Auth Onboarding & MFA Hooks"
Cohesion: 0.17
Nodes (21): @hookform/resolvers, react-hook-form, CheckEmailPage, LandingPage, PostLoginPage, LandingSurface(), useCheckEmail(), useEmailForm() (+13 more)

### Community 31 - "Communities, Calls & PWA Roadmap"
Cohesion: 0.11
Nodes (15): CommunityCard & Collapsible Chat Preview, Migration 0012_communities.sql, Roadmap #11: Communities Specification, Edge Function: livekit-token, Migration 0013_calls_enhancements.sql & start_call RPC, Roadmap #12: Calls (Voice & Video) Specification, useLiveKitRoom Hook & Active Call Modals, Roadmap #13: PWA, Offline & Push Notifications Specification (+7 more)

### Community 32 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, @biomejs/biome, @netlify/functions, supabase, tailwindcss, @tailwindcss/vite, @tanstack/devtools-vite, @tanstack/react-devtools (+7 more)

### Community 33 - "utils.ts"
Cohesion: 0.16
Nodes (10): clsx, @radix-ui/react-hover-card, @radix-ui/react-popover, tailwind-merge, BrandLockup(), BrandMark(), HoverCardContent, PopoverContent (+2 more)

### Community 34 - "App TypeScript Compiler Config"
Cohesion: 0.08
Nodes (23): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+15 more)

### Community 35 - "sheet.tsx"
Cohesion: 0.18
Nodes (11): class-variance-authority, BadgeProps, badgeVariants, SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader() (+3 more)

### Community 36 - "lib/auth-provider.tsx"
Cohesion: 0.09
Nodes (35): @supabase/supabase-js, generateBackupCodes(), AuthState, Profile, RefreshBody, SessionPayload, Action, useSecuritySettings() (+27 more)

### Community 37 - "Stories & Channels SQL Migration"
Cohesion: 0.11
Nodes (8): idx_messages_channel_cursor, idx_messages_reply_to_story, idx_stories_active, idx_stories_thumbnail, messages_validate_novedades, public.get_story_viewers(), public.set_message_reaction(), public.update_channel_info()

### Community 38 - "database.ts"
Cohesion: 0.12
Nodes (21): focus-trap-react, communityLayout, CommunityCardSurface(), CommunityChatRowContent(), CommunityCard(), CommunityChatListItem(), CommunityChatSidebar(), CreateCommunityChatModal() (+13 more)

### Community 39 - "settings-surfaces.tsx"
Cohesion: 0.17
Nodes (17): useTheme(), AccentChoice(), SETTINGS_ACCENTS, SettingsPageSurface(), SettingsToggle(), ThemeChoice(), Switch, SettingsPage() (+9 more)

### Community 40 - "Chats List Browser Test Suite"
Cohesion: 0.14
Nodes (19): ago(), creationCalls, errors, fulfill(), liveConfig, membership(), memberships, menu() (+11 more)

### Community 41 - "QueryState"
Cohesion: 0.20
Nodes (16): PublicProfileSurface(), ContactProfileModal(), QueryState(), Profile, usePublicProfile(), useSocialLinksForm(), clean(), FIXED_PLATFORMS (+8 more)

### Community 42 - "Foundations, Stack & Schema Roadmap"
Cohesion: 0.11
Nodes (14): LiveKit Token Generation Edge Function, SilverChat Infrastructure Stack, Frontend SPA Tech Stack (Vite 6 + React 19 + TypeScript Strict), Supabase Typed Client (src/lib/supabase.ts), Glassmorphism (.glass-surface) & Motion Tokens, handle_new_user() Auth Onboarding Trigger, SilverChat 21-Table Postgres Schema (0001_initial_schema.sql), profiles_visible Column-Level Privacy View (+6 more)

### Community 43 - "useChatUIStore"
Cohesion: 0.18
Nodes (14): useAddMembersDialog(), useChatSettingsLayer(), useContactProfile(), useContactProfileActions(), ChatModal, useChatUIStore, CreateDirectChatInput, formatDirectChatError() (+6 more)

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

### Community 53 - "lucide-react"
Cohesion: 0.25
Nodes (13): lucide-react, SharedFileRowSurface(), FileIconTile(), icons, FileRow(), FileMessage(), MediaPreviewModal(), formatBytes() (+5 more)

### Community 54 - "I18n & Theme System Roadmap"
Cohesion: 0.18
Nodes (12): src/features/settings/components/AppearanceScreen.tsx, src/lib/i18n.ts (i18next Configuration), src/app/providers/I18nProvider.tsx, src/types/i18n.d.ts (TypeScript i18next Definitions), 18 Locale JSON Files (9 Namespaces x en/es), src/app/main.tsx (Entry Point i18n Initialization), Prompt #14: Internationalization & Theme System Specification, src/lib/theme.ts (Theme & Accent Helpers) (+4 more)

### Community 55 - "Profile Settings & Block SQL Migration"
Cohesion: 0.18
Nodes (6): idx_devices_fingerprint, idx_profiles_pending_deletion, messages_block_check, profiles_username_change_validation, public.profiles_blocked, public.profiles_visible

### Community 56 - "shared.tsx"
Cohesion: 0.27
Nodes (14): useI18n(), settingsRowClassName, SettingsRowContent(), SettingsShellSurface(), LogoutConfirmModal(), SettingRow(), SettingsPage(), Toggle() (+6 more)

### Community 57 - "settings.profile.tsx"
Cohesion: 0.23
Nodes (12): browser-image-compression, react-easy-crop, AvatarPickerModal(), useAvatarPicker(), schema, useProfileForm(), cropAvatar(), deleteAvatarFile() (+4 more)

### Community 58 - "hooks.ts"
Cohesion: 0.20
Nodes (11): BlockUserModal(), blockUser(), Settings, SettingsPatch, useBlockedContacts(), useBlockedUsers(), useBlockUser(), AccountPreferences() (+3 more)

### Community 59 - "Messages Enhancements SQL Migration"
Cohesion: 0.25
Nodes (5): idx_messages_chat, idx_messages_mentions, idx_messages_thumbnail, messages_validate_media_mentions, public.validate_message_media_mentions()

### Community 60 - "PIF Shared Memory — Operating Protocol v1.0"
Cohesion: 0.13
Nodes (14): 10. Recovery, 11. Stop conditions, 12. Language, 1. Roles, 2. Canonical files and minimalism, 3. Claim classification, 4. Record and link conventions, 5. Controlled update transaction (+6 more)

### Community 61 - "upload.ts"
Cohesion: 0.32
Nodes (10): cleanupUploads(), prepareAndUpload(), safeFilename(), uploadToStorage(), videoThumbnail(), StoryCreator(), StoryTextEditor(), useCreateStory() (+2 more)

### Community 62 - "Profile & Account Deletion Roadmap"
Cohesion: 0.20
Nodes (6): Device Fingerprinting & Session Management (devices.ts), Prompt #6: Profile & User Settings Specification, Migration 0005: Profile Settings & Block Enforcement Triggers, Migration 0006: Account Deletion RPCs (schedule_account_deletion / cancel_account_deletion), Social Links Normalization (social-links.ts), ChatContextMenu, MultiSelectToolbar & SwipeActions

### Community 63 - "Chat Layout & Media Upload Roadmap"
Cohesion: 0.20
Nodes (5): Composer, Lazy Emoji Picker (frimousse) & @Mention Autocomplete, Prompt #8a: Chat Layout, Message Rendering & Composer Specification, MessageBubble & Consecutive Message Grouping (groupMessages.ts), MessageContent Dispatcher & 9 Content Subtypes, Migration 0008: Message Mentions GIN Index & Profiles Realtime

### Community 64 - "App Skeleton & Deletion Banner"
Cohesion: 0.43
Nodes (4): AppSkeleton(), ShellBackdrop(), Skeleton(), AuthenticatedLayout()

### Community 65 - "message-actions-concurrency.mjs"
Cohesion: 0.16
Nodes (9): args, clean(), dockerProbe, ids, sql(), args, clean(), dockerProbe (+1 more)

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
Cohesion: 0.20
Nodes (6): failures, fulfill(), jwt(), session(), storedHashes, wav

### Community 78 - "Query Storm & Story Burst Fix Docs"
Cohesion: 0.47
Nodes (3): Novedades Query Storm Fix Report, Supabase Health Outage Detection and Recovery Probe, Story Media Signed URL Burst & Slow get_story_viewers Fix Report

### Community 82 - "UI Migration Closeout & Review Docs"
Cohesion: 0.67
Nodes (3): UI Migration Closeout Policy, Standalone Visual Review Server (pnpm review:ui), Phased UI Migration Execution Log (Modules 1-6A)

### Community 100 - "_authenticated.chats.$chatId.tsx"
Cohesion: 0.27
Nodes (8): ConversationHeaderSurface(), CommunityChatHeader(), CommunityChatView(), ChatHeader(), PinnedMessagesBar(), ChatPage(), Conversation(), CommunityChatPage()

### Community 101 - "SettingsDialog"
Cohesion: 0.35
Nodes (10): SettingsDialog(), DeleteAccountModal(), PendingDeletionBanner(), useAccountActions(), useAccountDeletion(), useDeletionCancellation(), useEmailChange(), useProfileRefresh() (+2 more)

### Community 102 - "manifest.json"
Cohesion: 0.15
Nodes (12): approval_authority, baseline_revision, baseline_status, documentation_language, governance_owner, implementation_owner, last_reconciled_revision, note (+4 more)

### Community 103 - "useGroupSettings.ts"
Cohesion: 0.37
Nodes (7): useClearChat(), useGroupMembers(), useGroupSettings(), useLeaveGroup(), refreshChatSettings(), writeDraft(), useCommunityMembers()

### Community 104 - "settings-browser.mjs"
Cohesion: 0.15
Nodes (11): backupWrites, errors, fulfill(), other, patches, profile, removed, replacementHashes (+3 more)

### Community 105 - "PIF Session Handoff"
Cohesion: 0.22
Nodes (8): Active task and exact revision, Approved objective and scope, Blocking issues / pending approvals, Gate states and evidence, Last independently verified milestone, Latest source records, Next authorized action, PIF Session Handoff

### Community 106 - "voice-player.tsx"
Cohesion: 0.25
Nodes (5): @fontsource-variable/inter, react-dom, rootElement, PlaybackContract(), root

### Community 107 - "Engineer → Guardian Delivery Submission"
Cohesion: 0.25
Nodes (7): Changes made, Checks and evidence, Engineer → Guardian Delivery Submission, Human verification needed, Requested behavior and scope, Requested Guardian action, Risks / open gates

### Community 108 - "Project Baseline"
Cohesion: 0.25
Nodes (7): Approvals, Constraints and non-goals, Definition of Success, Goals, Problem and purpose, Project Baseline, Scope

### Community 109 - "Current Project State"
Cohesion: 0.29
Nodes (6): Active / blocked tasks, Current focus, Current Project State, Next authorized step, Open decisions and risks, Quality gates

### Community 110 - "Roadmap"
Cohesion: 0.50
Nodes (3): Approved scope changes, Milestones, Roadmap

## Knowledge Gaps
- **53 isolated node(s):** `linkifyjs`, `tw-animate-css`, `@biomejs/biome`, `@types/node`, `@types/react` (+48 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 643 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `MessageActionsProvider.tsx` to `useAction`, `App Navigation & Chat Menus`, `cn`, `Button`, `messages/types.ts`, `supabase.ts`, `Conversation Timeline & Bubbles`, `useMessages.ts`, `message-actions.test.ts`, `Chat Picker & Creation Hooks`, `Package DevDependencies Config`, `useAuth`, `useMessageText`, `i18n-provider.tsx`, `Avatar`, `@tanstack/react-router`, `ChannelView.tsx`, `NavLink`, `Auth Onboarding & MFA Hooks`, `utils.ts`, `sheet.tsx`, `lib/auth-provider.tsx`, `database.ts`, `settings-surfaces.tsx`, `QueryState`, `useChatUIStore`, `lucide-react`, `shared.tsx`, `settings.profile.tsx`, `hooks.ts`, `upload.ts`, `App Skeleton & Deletion Banner`, `_authenticated.chats.$chatId.tsx`, `SettingsDialog`, `voice-player.tsx`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **What connects `linkifyjs`, `tw-animate-css`, `@biomejs/biome` to the rest of the system?**
  _53 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Navigation & Chat Menus` be split into smaller, more focused modules?**
  _Cohesion score 0.06181410974244121 - nodes in this community are weakly interconnected._
- **Why does `useAuth()` connect `useAuth` to `useAction`, `App Navigation & Chat Menus`, `Button`, `MessageActionsProvider.tsx`, `messages/types.ts`, `supabase.ts`, `Conversation Timeline & Bubbles`, `useMessages.ts`, `Chat Picker & Creation Hooks`, `useMessageText`, `i18n-provider.tsx`, `Avatar`, `@tanstack/react-router`, `ChannelView.tsx`, `NavLink`, `Auth Onboarding & MFA Hooks`, `lib/auth-provider.tsx`, `database.ts`, `settings-surfaces.tsx`, `QueryState`, `useChatUIStore`, `shared.tsx`, `hooks.ts`, `upload.ts`, `App Skeleton & Deletion Banner`, `SettingsDialog`, `useGroupSettings.ts`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.10160427807486631 - nodes in this community are weakly interconnected._
- **Why does `Button` connect `Button` to `useAction`, `App Navigation & Chat Menus`, `cn`, `MessageActionsProvider.tsx`, `Chat Picker & Creation Hooks`, `useMessageText`, `i18n-provider.tsx`, `Avatar`, `ChannelView.tsx`, `NavLink`, `Auth Onboarding & MFA Hooks`, `database.ts`, `settings-surfaces.tsx`, `QueryState`, `lucide-react`, `shared.tsx`, `settings.profile.tsx`, `hooks.ts`, `upload.ts`, `SettingsDialog`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `Initial Postgres Database Schema` be split into smaller, more focused modules?**
  _Cohesion score 0.0673903211216644 - nodes in this community are weakly interconnected._