# Graph Report - silverchat  (2026-11-06)

## Corpus Check
- 499 files · ~282,510 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: .css 11, (none) 6, .example 1)

## Summary
- 2071 nodes · 7034 edges · 100 communities (74 shown, 26 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Profile, Theme & I18n Settings
- App Navigation & Chat Menus
- Radix UI Dialog & Card Primitives
- Initial Postgres Database Schema
- Netlify Auth BFF Serverless Functions
- Auth & Security Route Surfaces
- Novedades Stories & Channel Modals
- Message Media & Content Renderers
- Database Business Logic Triggers
- Channel Info & Story Replies
- Conversation Timeline & Bubbles
- Message Actions Browser Tests
- Message Bubble & Group Edit Actions
- Chat Settings Browser Tests
- Voice Recorder & Playback Dock
- Chat Picker & Creation Hooks
- Package DevDependencies Config
- Biome Linter & Formatter Config
- Package Runtime Dependencies
- Client Auth Session & Token Manager
- Novedades Browser Test Suite
- Message Composer & Attachment Menu
- App Root, Providers & Connection Banner
- Community & Destination Action Hooks
- Router Tree & Authenticated Guards
- Conversation Controller & Message Hooks
- Messages Browser Test Suite
- Row Level Security Policies
- Communities SQL Schema & RPCs
- Group Settings & Member List Screens
- Auth Onboarding & MFA Hooks
- Communities, Calls & PWA Roadmap
- Avatar & Channel Discovery Surfaces
- Chat Settings & Contact Profile Hooks
- App TypeScript Compiler Config
- Communities Sidebar & Navigation
- Chat & Community Header Search
- Stories & Channels SQL Migration
- Community Cards & Action Helpers
- Chat Options & Mute Submenu
- Chats List Browser Test Suite
- Shared Files & File Icon Tiles
- Foundations, Stack & Schema Roadmap
- Chats, Communities & Presence Queries
- Communities Browser Test Suite
- NPM Package Scripts
- UI Gallery Browser Test Suites
- Netlify Functions TypeScript Config
- Node Tooling TypeScript Config
- Media Upload & Video Thumbnail Lib
- UI Foundation & CSS Consumer Docs
- Message Actions SQL Migration
- Feature Architecture & Verification Docs
- Database Concurrency Test Suites
- I18n & Theme System Roadmap
- Profile Settings & Block SQL Migration
- Clear, Leave & Report Chat Modals
- Broadcast Channel View & Composer
- User Settings Browser Test Suite
- Messages Enhancements SQL Migration
- Turnstile Login & Email Auth Form
- Vite Config & UI Review Server
- Profile & Account Deletion Roadmap
- Chat Layout & Media Upload Roadmap
- App Skeleton & Deletion Banner
- Generated Supabase Database Types
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

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 204 edges
2. `react` - 178 edges
3. `Button` - 165 edges
4. `useMessageText()` - 157 edges
5. `cn()` - 81 edges
6. `lucide-react` - 80 edges
7. `supabase` - 78 edges
8. `@tanstack/react-query` - 73 edges
9. `useI18n()` - 67 edges
10. `Avatar()` - 58 edges

## Surprising Connections (you probably didn't know these)
- `Voice Playback Contract Test Fixture HTML (tests/voice-player.html)` --conceptually_related_to--> `Module 6A — Chat List, Creation and Final Migration Evidence`  [INFERRED]
  tests/voice-player.html → docs/ui-module-6a.md
- `Application HTML Entry (index.html)` --references--> `SilverChat Brand Favicon SVG (public/favicon.svg)`  [EXTRACTED]
  index.html → public/favicon.svg
- `UI Foundation Review Fixture HTML (tests/ui-foundation.html)` --references--> `SilverChat Brand Favicon SVG (public/favicon.svg)`  [EXTRACTED]
  tests/ui-foundation.html → public/favicon.svg
- `clearRedirectCookie()` --calls--> `buildSetCookie()`  [EXTRACTED]
  tests/auth-bff.test.ts → netlify/functions/_lib/cookies.ts
- `AuthGallery()` --calls--> `LandingSurface()`  [EXTRACTED]
  tests/auth-gallery.tsx → src/components/ui/auth-surfaces.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Supabase Postgres Schema, RLS Policies, Privacy View & SECURITY DEFINER RPCs** — roadmap_04a_data_model_entities_postgres_schema, roadmap_04a_data_model_entities_unified_chats_and_messages, roadmap_04b1_rls_policies_rls_security_model, roadmap_04b1_rls_policies_profiles_visible_view, roadmap_04b2_business_logic_rpc_business_triggers, roadmap_04b2_business_logic_rpc_security_definer_rpcs [EXTRACTED 1.00]
- **SPA + Netlify BFF Magic-Link, HttpOnly Refresh Cookie & TOTP/Backup-Code Auth Flow** — roadmap_04a_data_model_entities_handle_new_user_trigger, roadmap_05_authentication_netlify_bff_cookie_architecture, roadmap_05_authentication_client_auth_and_protected_routes, roadmap_05_authentication_totp_2fa_and_backup_codes [EXTRACTED 1.00]
- **SilverChat Tailwind v4 OKLCH Three-Layer Theme Cascade & Glass/Motion System** — roadmap_03_design_system_three_layer_token_cascade, roadmap_03_design_system_tailwind_v4_theme_inline_bridge, roadmap_03_design_system_glassmorphism_and_motion_system [EXTRACTED 1.00]
- **Chat Read Receipt & Unread State Lifecycle** — roadmap_06_profile_settings_privacy_visibility, roadmap_07_chats_list_manually_unread, roadmap_07_chats_list_use_chats, roadmap_08a_chat_layout_messages_auto_mark_read [EXTRACTED 1.00]
- **Unified Message Rendering, Composer & Actions Pipeline** — roadmap_08a_chat_layout_messages_message_list_scroll, roadmap_08a_chat_layout_messages_message_bubble_grouping, roadmap_08a_chat_layout_messages_composer, roadmap_08b_message_actions_action_matrix, roadmap_08b_message_actions_reply_forward_edit_delete, roadmap_10_novedades_stories_channels_channel_view [EXTRACTED 1.00]
- **Client-Side Media Optimization & Storage Upload Pipeline** — roadmap_06_profile_settings_avatar_upload, roadmap_08a_chat_layout_messages_media_upload_flow, roadmap_08b_message_actions_voice_notes, roadmap_09_contact_profile_chat_settings_shared_media_view, roadmap_10_novedades_stories_channels_story_creator [EXTRACTED 1.00]
- **Real-Time Voice/Video Call Signaling, LiveKit Media & Push Notification Flow** — roadmap_12_calls_migration_0013, roadmap_12_calls_livekit_token_edge_function, roadmap_12_calls_call_state_machine, roadmap_12_calls_use_livekit_room, roadmap_13_pwa_offline_web_push_pipeline [EXTRACTED 1.00]
- **PWA Caching, IndexedDB Outbox & Device Push Subscription Lifecycle** — roadmap_13_pwa_offline_workbox_caching, roadmap_13_pwa_offline_indexeddb_outbox, roadmap_13_pwa_offline_web_push_pipeline, roadmap_15_privacy_security_auth_logout_all [INFERRED 0.85]
- **Production Deployment, Security Headers, Health Checks & Sentry Observability** — roadmap_16_deployment_metadata_sentry_monitoring, roadmap_16_deployment_metadata_ci_netlify_config, roadmap_16_deployment_metadata_health_endpoints, roadmap_16_deployment_metadata_deploy_fase2_docs [EXTRACTED 1.00]
- **Cross-Device Preference Persistence & FOUC-Free Boot Flow** — roadmap_14_i18n_theme_fouc_prevention_script, roadmap_14_i18n_theme_theme_lib, roadmap_14_i18n_theme_use_theme, roadmap_14_i18n_theme_use_language, roadmap_14_i18n_theme_dual_persistence_pattern [EXTRACTED 1.00]
- **Type-Safe Multi-Namespace i18next Architecture** — roadmap_14_i18n_theme_i18n_lib, roadmap_14_i18n_theme_i18n_types, roadmap_14_i18n_theme_i18n_provider, roadmap_14_i18n_theme_locale_namespaces, roadmap_14_i18n_theme_use_formatters [EXTRACTED 1.00]
- **Shared Conversation, Timeline, Composer, and Message Actions Across Direct, Group, Community, and Broadcast Channels** — docs_messages_architecture, docs_message_actions_architecture, docs_communities_architecture, docs_novedades_architecture, ui_migration_map_contract_ledger [EXTRACTED 1.00]
- **AAL2 MFA-Gated Security Definer RPCs and Privacy Views Across All Feature Domains** — docs_authentication_aal2_mfa_contract, docs_chats_list_architecture, docs_chat_settings_architecture, docs_communities_architecture, docs_novedades_architecture [EXTRACTED 1.00]
- **UI Migration Governance: Step A Hook Extraction, Contract Ledger, and Screenshot-Free Clean Browser Verification** — agents_working_agreements, readme_visual_review_server, ui_migration_map_step_a_extraction_queue, ui_migration_map_contract_ledger, ui_migration_map_modules_1_to_6a [EXTRACTED 1.00]
- **SilverChat UI Migration Verification, CSS Inventory, and Module 6A Closeout** — docs_ui_foundation_doc, docs_ui_feedback_review_doc, docs_review_path_evidence_doc, docs_ui_css_consumers_doc, docs_ui_migration_closeout_doc, docs_ui_module_6a_doc, tests_ui_foundation_fixture_html [EXTRACTED 1.00]
- **Novedades Query Storm & Signed Media URL Burst Resilience Architecture** — docs_query_storm_fix_doc, docs_query_storm_fix_novedades_query_storm_mitigation, docs_query_storm_fix_supabase_health_circuit_breaker, docs_story_media_burst_fix_doc, docs_story_media_burst_fix_lazy_jittered_media_signing, docs_story_media_burst_fix_get_story_viewers_optimization [EXTRACTED 1.00]
- **Supabase Backend Schema, Staging Migrations, and Profile/Settings Lifecycle** — supabase_readme_doc, supabase_readme_backend_schema_and_rls, docs_staging_migrations_report_doc, docs_staging_migrations_report_crlf_migration_guard, docs_profile_settings_doc, docs_profile_settings_cleanup_deleted_accounts [EXTRACTED 1.00]

## Communities (100 total, 26 thin omitted)

### Community 0 - "Profile, Theme & I18n Settings"
Cohesion: 0.05
Nodes (103): browser-image-compression, react-easy-crop, I18nContext, spanish, useI18n(), useTheme(), PublicProfileSurface(), settingsRowClassName (+95 more)

### Community 1 - "App Navigation & Chat Menus"
Cohesion: 0.06
Nodes (72): react, Badge, BadgeProps, badgeVariants, ChatMenuItem, ChatMenuSurface(), FloatingActionButton(), icons (+64 more)

### Community 2 - "Radix UI Dialog & Card Primitives"
Cohesion: 0.07
Nodes (46): clsx, @radix-ui/react-dialog, @radix-ui/react-hover-card, @radix-ui/react-popover, @radix-ui/react-separator, tailwind-merge, BrandLockup(), BrandMark() (+38 more)

### Community 3 - "Initial Postgres Database Schema"
Cohesion: 0.07
Nodes (64): app_config_set_updated_at, channels_set_updated_at, chats_set_updated_at, communities_set_updated_at, idx_calls_chat, idx_calls_initiator, idx_calls_ringing, idx_channel_followers_user (+56 more)

### Community 4 - "Netlify Auth BFF Serverless Functions"
Cohesion: 0.12
Nodes (45): allowAttempt(), attempts, handler(), schema, handler(), handler(), handler(), schema (+37 more)

### Community 5 - "Auth & Security Route Surfaces"
Cohesion: 0.12
Nodes (28): class-variance-authority, @radix-ui/react-slot, AuthenticatedDestination(), PickUsernamePage, SecurityPage, WelcomePage, AuthCard(), BackupCodesSurface() (+20 more)

### Community 6 - "Novedades Stories & Channel Modals"
Cohesion: 0.12
Nodes (26): MotionOverlay(), StoryCardSurface(), StoryProgressSurface(), StoryReplySurface(), StoryStageSurface(), ChannelsSection(), CreateChannelModal(), DiscoverChannelsSection() (+18 more)

### Community 7 - "Message Media & Content Renderers"
Cohesion: 0.17
Nodes (26): SharedMediaTab(), Tile(), AudioMessage(), ContactMessage(), DownloadButton(), ImageMessage(), LocationMessage(), StickerMessage() (+18 more)

### Community 8 - "Database Business Logic Triggers"
Cohesion: 0.07
Nodes (20): channel_followers_after_delete, channel_followers_after_insert, chat_members_after_delete, community_members_after_delete, community_members_after_insert, idx_channels_last_message, messages_after_insert, messages_after_update (+12 more)

### Community 9 - "Channel Info & Story Replies"
Cohesion: 0.16
Nodes (21): @tanstack/react-query, Profile, ChannelHeader(), ChannelInfoScreen(), EditFields(), useChannelDeletion(), useChannelHeaderActions(), useFollowChannel() (+13 more)

### Community 10 - "Conversation Timeline & Bubbles"
Cohesion: 0.12
Nodes (23): BubbleSurface(), MessageSurface(), ReactionChip(), TimelineDate(), TimelineUnread(), TextMessage(), DateSeparator(), MessageList() (+15 more)

### Community 11 - "Message Actions Browser Tests"
Cohesion: 0.07
Nodes (34): ago(), bubble(), channels, chat(), chatId, errors, forwardCalls, goto() (+26 more)

### Community 12 - "Message Bubble & Group Edit Actions"
Cohesion: 0.16
Nodes (21): EditMessageModal(), Context, MessageActionsProvider(), useMessageActionUI(), MessageBubble(), actionIcons, MessageContextMenu(), ReactionsDisplay() (+13 more)

### Community 13 - "Chat Settings Browser Tests"
Cohesion: 0.07
Nodes (32): ago(), channels, chat(), chatId, errors, fileRows, goto(), groupId (+24 more)

### Community 14 - "Voice Recorder & Playback Dock"
Cohesion: 0.13
Nodes (21): zustand, ComposerDock(), quickReactionEmoji, ReplySurface(), VoiceWaveform(), Textarea, VoicePlayer(), VoiceRecorder() (+13 more)

### Community 15 - "Chat Picker & Creation Hooks"
Cohesion: 0.16
Nodes (24): ChatSettingsNotice(), ChatModal, useChatUIStore, ChatContactRow(), ChatListSkeleton(), CreateDirectChatInput, useCreateDirectChat(), CreateGroupChatInput (+16 more)

### Community 16 - "Package DevDependencies Config"
Cohesion: 0.06
Nodes (32): devDependencies, @biomejs/biome, @netlify/functions, supabase, tailwindcss, @tailwindcss/vite, @types/node, @types/react (+24 more)

### Community 17 - "Biome Linter & Formatter Config"
Cohesion: 0.06
Nodes (30): source, assist, actions, noUnusedImports, noUnusedVariables, css, parser, files (+22 more)

### Community 18 - "Package Runtime Dependencies"
Cohesion: 0.06
Nodes (31): dependencies, browser-image-compression, class-variance-authority, clsx, focus-trap-react, @fontsource-variable/inter, frimousse, @hookform/resolvers (+23 more)

### Community 19 - "Client Auth Session & Token Manager"
Cohesion: 0.15
Nodes (25): @supabase/supabase-js, AuthState, Profile, RefreshBody, SessionPayload, authApi(), AuthError, beforeSignOut (+17 more)

### Community 20 - "Novedades Browser Test Suite"
Cohesion: 0.08
Nodes (28): channels, direct, errors, followed, follows, goto(), longClip, me (+20 more)

### Community 21 - "Message Composer & Attachment Menu"
Cohesion: 0.13
Nodes (19): frimousse, QuickReactions(), Modal(), AttachmentMenu(), Composer(), EmojiPanel, ContactPicker(), DeleteMessageModal() (+11 more)

### Community 22 - "App Root, Providers & Connection Banner"
Cohesion: 0.14
Nodes (20): react-dom, App(), AuthenticatedRouter(), queryClient, ConnectionBanner(), rootElement, I18nProvider(), Accent (+12 more)

### Community 23 - "Community & Destination Action Hooks"
Cohesion: 0.23
Nodes (16): useDestinationActions(), useAddMembers(), useCommunityChats(), useCommunitySettingsActions(), useCreateCommunity(), useCreateCommunityChat(), useCreateCommunityDialog(), useDeleteCommunity() (+8 more)

### Community 24 - "Router Tree & Authenticated Guards"
Cohesion: 0.11
Nodes (24): authenticated, AuthErrorPage, CheckEmailPage, communityChildren, LandingPage, MfaVerifyPage, PostLoginPage, protectedRoutes (+16 more)

### Community 25 - "Conversation Controller & Message Hooks"
Cohesion: 0.19
Nodes (19): useSharedMedia(), useConversationController(), useInChatSearch(), useMarkAsRead(), Action, useMessageActions(), enrichMessages(), useMessages() (+11 more)

### Community 26 - "Messages Browser Test Suite"
Cohesion: 0.09
Nodes (25): ago(), channels, chat(), chatId, errors, goto(), groupId, groupRows (+17 more)

### Community 27 - "Row Level Security Policies"
Cohesion: 0.09
Nodes (15): messages_before_update_guard, public.can_view_avatar(), public.can_view_story(), public.has_read_receipts_enabled(), public.is_blocked(), public.is_blocked_either_way(), public.is_channel_follower(), public.is_channel_owner() (+7 more)

### Community 28 - "Communities SQL Schema & RPCs"
Cohesion: 0.09
Nodes (5): community_members_after_delete, community_members_after_role_update, profiles_before_delete_community_succession, public.create_community(), public.handle_profile_deletion_community_succession()

### Community 29 - "Group Settings & Member List Screens"
Cohesion: 0.19
Nodes (16): ChatSettingsScreenSurface(), ChatSettingsLayer(), ChatSettingsLoading(), GroupMembersList(), GroupFields(), GroupSettingsScreen(), SharedFilesTab(), SharedMediaView() (+8 more)

### Community 30 - "Auth Onboarding & MFA Hooks"
Cohesion: 0.24
Nodes (15): @hookform/resolvers, react-hook-form, @tanstack/react-router, useCheckEmail(), useMfaVerification(), useOnboardingWelcome(), nextDestination(), safeRedirect() (+7 more)

### Community 31 - "Communities, Calls & PWA Roadmap"
Cohesion: 0.11
Nodes (15): CommunityCard & Collapsible Chat Preview, Migration 0012_communities.sql, Roadmap #11: Communities Specification, Edge Function: livekit-token, Migration 0013_calls_enhancements.sql & start_call RPC, Roadmap #12: Calls (Voice & Video) Specification, useLiveKitRoom Hook & Active Call Modals, Roadmap #13: PWA, Offline & Push Notifications Specification (+7 more)

### Community 32 - "Avatar & Channel Discovery Surfaces"
Cohesion: 0.20
Nodes (16): Avatar(), sizes, ChannelFollowButton(), ChannelInfoSurface(), ChannelRowContent(), MemberRowSurface(), SharedFileRowSurface(), SharedMediaTileSurface() (+8 more)

### Community 33 - "Chat Settings & Contact Profile Hooks"
Cohesion: 0.23
Nodes (10): useChatSettingsLayer(), useClearChat(), useGroupMembers(), useGroupSettings(), useLeaveGroup(), refreshChatSettings(), useCommunityMembers(), useRealtimeMessages() (+2 more)

### Community 34 - "App TypeScript Compiler Config"
Cohesion: 0.08
Nodes (23): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+15 more)

### Community 35 - "Communities Sidebar & Navigation"
Cohesion: 0.17
Nodes (13): focus-trap-react, communityLayout, CommunitiesList(), CommunityChatSidebar(), CreateCommunityChatModal(), CreateCommunityModal(), CreationDialog(), useCommunity() (+5 more)

### Community 36 - "Chat & Community Header Search"
Cohesion: 0.18
Nodes (12): ConversationHeaderSurface(), CommunityChatHeader(), CommunityChatView(), ChatHeader(), InChatSearch(), PinnedMessagesBar(), useMediaSend(), useUploadProgress() (+4 more)

### Community 37 - "Stories & Channels SQL Migration"
Cohesion: 0.11
Nodes (8): idx_messages_channel_cursor, idx_messages_reply_to_story, idx_stories_active, idx_stories_thumbnail, messages_validate_novedades, public.get_story_viewers(), public.set_message_reaction(), public.update_channel_info()

### Community 38 - "Community Cards & Action Helpers"
Cohesion: 0.20
Nodes (15): CommunityCardSurface(), CommunityChatRowContent(), CommunityCard(), CommunityChatListItem(), CommunityAction, formatCommunityTimestamp(), getAvailableCommunityActions(), orderCommunities() (+7 more)

### Community 39 - "Chat Options & Mute Submenu"
Cohesion: 0.22
Nodes (14): AddMembersModal(), ChatOptionsMenu(), MenuProps, MuteSubmenu(), useAddMembersDialog(), ChannelAction, ChannelActionContext, ChatAction (+6 more)

### Community 40 - "Chats List Browser Test Suite"
Cohesion: 0.14
Nodes (19): ago(), creationCalls, errors, fulfill(), liveConfig, membership(), memberships, menu() (+11 more)

### Community 41 - "Shared Files & File Icon Tiles"
Cohesion: 0.24
Nodes (13): lucide-react, FileIconTile(), icons, FileRow(), useSharedFileDownload(), FileMessage(), MediaPreviewModal(), formatBytes() (+5 more)

### Community 42 - "Foundations, Stack & Schema Roadmap"
Cohesion: 0.11
Nodes (14): LiveKit Token Generation Edge Function, SilverChat Infrastructure Stack, Frontend SPA Tech Stack (Vite 6 + React 19 + TypeScript Strict), Supabase Typed Client (src/lib/supabase.ts), Glassmorphism (.glass-surface) & Motion Tokens, handle_new_user() Auth Onboarding Trigger, SilverChat 21-Table Postgres Schema (0001_initial_schema.sql), profiles_visible Column-Level Privacy View (+6 more)

### Community 43 - "Chats, Communities & Presence Queries"
Cohesion: 0.18
Nodes (12): allRows(), chunks(), useCommunities(), useCommunityConversation(), useChat(), useChatPresence(), StoriesRow(), useChannels() (+4 more)

### Community 44 - "Communities Browser Test Suite"
Cohesion: 0.13
Nodes (18): calls, chat(), chats, cid, errors, general, me, member() (+10 more)

### Community 45 - "NPM Package Scripts"
Cohesion: 0.11
Nodes (18): scripts, build, db:types, dev, lint, lint:fix, preinstall, preview (+10 more)

### Community 47 - "Netlify Functions TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess, noUnusedLocals (+8 more)

### Community 48 - "Node Tooling TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 49 - "Media Upload & Video Thumbnail Lib"
Cohesion: 0.28
Nodes (11): saveGroupAvatar(), cleanupUploads(), prepareAndUpload(), safeFilename(), uploadToStorage(), videoThumbnail(), Upload, useCreateChannel() (+3 more)

### Community 50 - "UI Foundation & CSS Consumer Docs"
Cohesion: 0.17
Nodes (10): Review-Path Diagnosis and Verification, CSS Consumer Inventory — Module 6A, Verified UI Review Procedure, SilverChat UI Foundation Specification, Historical UI Migration Closeout — Module 5C / TASK-006, Module 6A — Chat List, Creation and Final Migration Evidence, Application HTML Entry (index.html), SilverChat Brand Favicon SVG (public/favicon.svg) (+2 more)

### Community 51 - "Message Actions SQL Migration"
Cohesion: 0.16
Nodes (4): idx_messages_forwarded_from, messages_pin_limit, messages_validate_edit, public.can_access_chat_message()

### Community 52 - "Feature Architecture & Verification Docs"
Cohesion: 0.20
Nodes (13): Prompt 09 Contact Profile & Chat Settings Verification Report, Prompt 08b Message Actions Verification Report, Contact Profiles, Group Admin RPCs & Shared Media (Prompt 09 / Migration 0011), Active Chats List, Filters, Requests & Local Drafts (Prompt 07 / Migration 0007), Communities Hierarchy, Succession & Shared Conversation (Prompt 11 / Migration 0014), Hardened Message Actions & Exclusive Voice Notes (Prompt 08b / Migration 0010), Conversation History, Optimistic Outbox & Private Media (Prompt 08a / Migration 0008), New Direct Chat & New Group Creation Flows (Prompt 07 Gap Fix) (+5 more)

### Community 53 - "Database Concurrency Test Suites"
Cohesion: 0.16
Nodes (9): args, clean(), dockerProbe, ids, sql(), args, clean(), dockerProbe (+1 more)

### Community 54 - "I18n & Theme System Roadmap"
Cohesion: 0.18
Nodes (12): src/features/settings/components/AppearanceScreen.tsx, src/lib/i18n.ts (i18next Configuration), src/app/providers/I18nProvider.tsx, src/types/i18n.d.ts (TypeScript i18next Definitions), 18 Locale JSON Files (9 Namespaces x en/es), src/app/main.tsx (Entry Point i18n Initialization), Prompt #14: Internationalization & Theme System Specification, src/lib/theme.ts (Theme & Accent Helpers) (+4 more)

### Community 55 - "Profile Settings & Block SQL Migration"
Cohesion: 0.18
Nodes (6): idx_devices_fingerprint, idx_profiles_pending_deletion, messages_block_check, profiles_username_change_validation, public.profiles_blocked, public.profiles_visible

### Community 56 - "Clear, Leave & Report Chat Modals"
Cohesion: 0.29
Nodes (9): ChatSettingsDialog(), ClearChatModal(), LeaveGroupModal(), ReportModal(), useClearChatDialog(), useReportDialog(), ReportReason, useReportUser() (+1 more)

### Community 57 - "Broadcast Channel View & Composer"
Cohesion: 0.32
Nodes (6): ChannelComposer(), ChannelView(), useChannelInfo(), useChannelReadCursor(), channelChat(), ChannelPage()

### Community 58 - "User Settings Browser Test Suite"
Cohesion: 0.15
Nodes (11): backupWrites, errors, fulfill(), other, patches, profile, removed, replacementHashes (+3 more)

### Community 59 - "Messages Enhancements SQL Migration"
Cohesion: 0.25
Nodes (5): idx_messages_chat, idx_messages_mentions, idx_messages_thumbnail, messages_validate_media_mentions, public.validate_message_media_mentions()

### Community 60 - "Turnstile Login & Email Auth Form"
Cohesion: 0.31
Nodes (7): @marsidev/react-turnstile, LoginPage, SignupPage, EmailForm(), useEmailForm(), LoginPage(), SignupPage()

### Community 61 - "Vite Config & UI Review Server"
Cohesion: 0.24
Nodes (5): @tailwindcss/vite, vite, @vitejs/plugin-react, uiReviewLinks(), alias

### Community 62 - "Profile & Account Deletion Roadmap"
Cohesion: 0.20
Nodes (6): Device Fingerprinting & Session Management (devices.ts), Prompt #6: Profile & User Settings Specification, Migration 0005: Profile Settings & Block Enforcement Triggers, Migration 0006: Account Deletion RPCs (schedule_account_deletion / cancel_account_deletion), Social Links Normalization (social-links.ts), ChatContextMenu, MultiSelectToolbar & SwipeActions

### Community 63 - "Chat Layout & Media Upload Roadmap"
Cohesion: 0.20
Nodes (5): Composer, Lazy Emoji Picker (frimousse) & @Mention Autocomplete, Prompt #8a: Chat Layout, Message Rendering & Composer Specification, MessageBubble & Consecutive Message Grouping (groupMessages.ts), MessageContent Dispatcher & 9 Content Subtypes, Migration 0008: Message Mentions GIN Index & Profiles Realtime

### Community 64 - "App Skeleton & Deletion Banner"
Cohesion: 0.36
Nodes (5): AppSkeleton(), ShellBackdrop(), Skeleton(), PendingDeletionBanner(), AuthenticatedLayout()

### Community 65 - "Generated Supabase Database Types"
Cohesion: 0.20
Nodes (9): CompositeTypes, Constants, DatabaseWithoutInternals, DefaultSchema, Enums, Json, Tables, TablesInsert (+1 more)

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

### Community 82 - "UI Migration Closeout & Review Docs"
Cohesion: 0.67
Nodes (3): UI Migration Closeout Policy, Standalone Visual Review Server (pnpm review:ui), Phased UI Migration Execution Log (Modules 1-6A)

## Knowledge Gaps
- **50 isolated node(s):** `linkifyjs`, `tw-animate-css`, `@biomejs/biome`, `@types/node`, `@types/react` (+45 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 599 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App Navigation & Chat Menus` to `Profile, Theme & I18n Settings`, `Radix UI Dialog & Card Primitives`, `Auth & Security Route Surfaces`, `Novedades Stories & Channel Modals`, `Message Media & Content Renderers`, `Channel Info & Story Replies`, `Conversation Timeline & Bubbles`, `Message Bubble & Group Edit Actions`, `Voice Recorder & Playback Dock`, `Chat Picker & Creation Hooks`, `Package DevDependencies Config`, `Client Auth Session & Token Manager`, `Message Composer & Attachment Menu`, `App Root, Providers & Connection Banner`, `Community & Destination Action Hooks`, `Router Tree & Authenticated Guards`, `Conversation Controller & Message Hooks`, `Group Settings & Member List Screens`, `Auth Onboarding & MFA Hooks`, `Avatar & Channel Discovery Surfaces`, `Chat Settings & Contact Profile Hooks`, `Communities Sidebar & Navigation`, `Chat & Community Header Search`, `Community Cards & Action Helpers`, `Shared Files & File Icon Tiles`, `Chats, Communities & Presence Queries`, `Media Upload & Video Thumbnail Lib`, `Clear, Leave & Report Chat Modals`, `Broadcast Channel View & Composer`, `App Skeleton & Deletion Banner`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **What connects `linkifyjs`, `tw-animate-css`, `@biomejs/biome` to the rest of the system?**
  _50 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Profile, Theme & I18n Settings` be split into smaller, more focused modules?**
  _Cohesion score 0.05125558995528036 - nodes in this community are weakly interconnected._
- **Why does `useAuth()` connect `Community & Destination Action Hooks` to `Profile, Theme & I18n Settings`, `App Navigation & Chat Menus`, `Auth & Security Route Surfaces`, `Novedades Stories & Channel Modals`, `Message Media & Content Renderers`, `Channel Info & Story Replies`, `Conversation Timeline & Bubbles`, `Message Bubble & Group Edit Actions`, `Chat Picker & Creation Hooks`, `Client Auth Session & Token Manager`, `Message Composer & Attachment Menu`, `App Root, Providers & Connection Banner`, `Router Tree & Authenticated Guards`, `Conversation Controller & Message Hooks`, `Group Settings & Member List Screens`, `Auth Onboarding & MFA Hooks`, `Chat Settings & Contact Profile Hooks`, `Communities Sidebar & Navigation`, `Chat & Community Header Search`, `Chat Options & Mute Submenu`, `Chats, Communities & Presence Queries`, `Media Upload & Video Thumbnail Lib`, `Clear, Leave & Report Chat Modals`, `Broadcast Channel View & Composer`, `Turnstile Login & Email Auth Form`, `App Skeleton & Deletion Banner`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `App Navigation & Chat Menus` be split into smaller, more focused modules?**
  _Cohesion score 0.06271893244370308 - nodes in this community are weakly interconnected._
- **Why does `Button` connect `Auth & Security Route Surfaces` to `Profile, Theme & I18n Settings`, `App Navigation & Chat Menus`, `Radix UI Dialog & Card Primitives`, `Novedades Stories & Channel Modals`, `Channel Info & Story Replies`, `Message Bubble & Group Edit Actions`, `Voice Recorder & Playback Dock`, `Chat Picker & Creation Hooks`, `Message Composer & Attachment Menu`, `App Root, Providers & Connection Banner`, `Router Tree & Authenticated Guards`, `Group Settings & Member List Screens`, `Auth Onboarding & MFA Hooks`, `Avatar & Channel Discovery Surfaces`, `Communities Sidebar & Navigation`, `Chat Options & Mute Submenu`, `Shared Files & File Icon Tiles`, `Clear, Leave & Report Chat Modals`, `Broadcast Channel View & Composer`, `Turnstile Login & Email Auth Form`, `App Skeleton & Deletion Banner`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Should `Radix UI Dialog & Card Primitives` be split into smaller, more focused modules?**
  _Cohesion score 0.06606990622335891 - nodes in this community are weakly interconnected._