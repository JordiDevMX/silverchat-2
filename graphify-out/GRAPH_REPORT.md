# Graph Report - .roadmap  (2026-10-21)

## Corpus Check
- 19 files · ~72,448 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 393 nodes · 482 edges · 43 communities (18 shown, 25 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.83)
- Token cost: 132,000 input · 46,200 output

## Community Hubs (Navigation)
- Profiles & Privacy Core
- Stories & Channels System
- Internationalization & Themes
- Chat UI & Communities
- Calls & LiveKit Integration
- Messages, Composer & Reactions
- Authentication & BFF Stack
- Chats List & Requests
- Devices, Offline & Security
- Message Actions Layer
- Deployment & Observability
- Storage & Account Lifecycle
- Community RPCs & Succession
- PWA Install Experience
- Design Token System
- Workbox Cache Strategies
- Privacy Visibility Hooks
- Tailwind CSS Config
- Service Worker Updates
- Blocked Contacts
- Storage Usage UI
- CI & Netlify Deploy
- Security Headers
- SPA Routing Decision
- Channel Followers
- Message Deletion (Per User)
- Presence Polling
- Call Log UI
- Active Call Hook
- Account Screen
- Open Graph Metadata
- robots.txt
- Sitemap XML
- Accessibility Rules
- Runtime Feature Flags
- Community Members Table
- Channel Owner Helper
- Migration 0005 (Profile)
- linkify-react Dependency

## God Nodes (most connected - your core abstractions)
1. `ChatOptionsMenu` - 14 edges
2. `chats table (direct group self community_chat)` - 12 edges
3. `useTheme` - 11 edges
4. `profiles table` - 10 edges
5. `Chats List Screen (Prompt #7)` - 9 edges
6. `messages table (chat + channel unified)` - 8 edges
7. `create_direct_chat_request() RPC` - 8 edges
8. `Migration 0011: Stories & Channels` - 8 edges
9. `Migration 0012: Communities` - 8 edges
10. `i18n.init (i18next configuration)` - 8 edges

## Surprising Connections (you probably didn't know these)
- `30-day username change cooldown` --semantically_similar_to--> `7-day rejection cooldown`  [INFERRED] [semantically similar]
  06-profile-settings.md → 04b2-business-logic-rpc.md
- `useChannelMessages()` --semantically_similar_to--> `useMessages()`  [INFERRED] [semantically similar]
  10-novedades-stories-channels.md → 08a-chat-layout-messages.md
- `Community Ownership Succession` --semantically_similar_to--> `chat_members_after_delete trigger (group admin promotion, from #4b-2)`  [INFERRED] [semantically similar]
  11-communities.md → 09-contact-profile-chat-settings.md
- `notify_new_call trigger` --semantically_similar_to--> `useIncomingCall hook`  [INFERRED] [semantically similar]
  13-pwa-offline.md → 12-calls.md
- `/health SPA route` --semantically_similar_to--> `useSecuritySummary hook`  [INFERRED] [semantically similar]
  16-deployment-metadata.md → 15-privacy-security.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **RLS security layer (helpers, view, philosophy)** — roadmap_04b1_rls_policies_is_chat_member, roadmap_04b1_rls_policies_is_blocked_either_way, roadmap_04b1_rls_policies_can_view_avatar, roadmap_04b1_rls_policies_profiles_visible, roadmap_04b1_rls_policies_fair_trade_read_receipts, roadmap_04b1_rls_policies_rpc_only_writes, roadmap_04b1_rls_policies_is_chat_active, roadmap_04b1_rls_policies_storage_bucket_policies [EXTRACTED 1.00]
- **Stranger chat request flow** — roadmap_04b2_business_logic_rpc_create_direct_chat_request, roadmap_04b2_business_logic_rpc_accept_chat_request, roadmap_04b2_business_logic_rpc_reject_chat_request, roadmap_04b2_business_logic_rpc_pending_request_flow, roadmap_04b2_business_logic_rpc_seven_day_cooldown [EXTRACTED 1.00]
- **BFF auth session pipeline** — roadmap_05_authentication_bff_architecture, roadmap_05_authentication_auth_signin, roadmap_05_authentication_auth_refresh, roadmap_05_authentication_auth_token_manager, roadmap_05_authentication_auth_provider_context, roadmap_05_authentication_httponly_cookie_sessions [EXTRACTED 1.00]
- **Shared Chat Component Reuse System (#8a-#8b reused by #9, #10, #11)** — roadmap_08a_chat_layout_messages_messagelist, roadmap_08a_chat_layout_messages_messagebubble, roadmap_08a_chat_layout_messages_composer, roadmap_08a_chat_layout_messages_chatheader, roadmap_08b_message_actions_messagecontextmenu, roadmap_08b_message_actions_pinnedmessagesbar, roadmap_08b_message_actions_inchatsearch [EXTRACTED 0.95]
- **Group Admin & Member Lifecycle RPCs (#9)** — roadmap_09_contact_profile_chat_settings_usegroupmembers, roadmap_09_contact_profile_chat_settings_add_chat_members_rpc, roadmap_09_contact_profile_chat_settings_remove_chat_member_rpc, roadmap_09_contact_profile_chat_settings_promote_chat_admin_rpc, roadmap_09_contact_profile_chat_settings_demote_chat_admin_rpc, roadmap_09_contact_profile_chat_settings_update_group_info_rpc, roadmap_09_contact_profile_chat_settings_groupmemberslist [EXTRACTED 1.00]
- **Community Ownership Succession Flow** — roadmap_11_communities_ownership_succession, roadmap_11_communities_handle_community_member_delete_trigger, roadmap_11_communities_handle_profile_deletion_community_succession_trigger, roadmap_11_communities_leave_community_rpc, roadmap_11_communities_useleavecommunity, roadmap_11_communities_communityinfoscreen [EXTRACTED 1.00]
- **Call Lifecycle & UI Flow** — _roadmap_12_calls_call_provider, _roadmap_12_calls_call_store, _roadmap_12_calls_use_start_call, _roadmap_12_calls_use_incoming_call, _roadmap_12_calls_incoming_call_modal, _roadmap_12_calls_outgoing_call_modal, _roadmap_12_calls_active_call_modal, _roadmap_12_calls_active_video_call_modal, _roadmap_12_calls_use_livekit_room [INFERRED 0.95]
- **Offline Messaging Pipeline (IndexedDB + Outbox)** — _roadmap_13_pwa_offline_offline_db, _roadmap_13_pwa_offline_message_cache, _roadmap_13_pwa_offline_outbox, _roadmap_13_pwa_offline_use_outbox_processor, _roadmap_13_pwa_offline_use_online_status, _roadmap_13_pwa_offline_offline_banner [INFERRED 0.95]
- **Web Push Delivery Chain (DB trigger -> Edge Function -> Service Worker)** — _roadmap_13_pwa_offline_notify_new_message, _roadmap_13_pwa_offline_notify_new_call, _roadmap_13_pwa_offline_send_push_edge_function, _roadmap_13_pwa_offline_sw_custom_push_handler, _roadmap_13_pwa_offline_push_lib, _roadmap_13_pwa_offline_use_push_subscription, _roadmap_13_pwa_offline_vapid_push [INFERRED 0.95]
- **Runtime theme/accent application flow** — src_hooks_usetheme_usetheme, src_lib_theme_applytheme, src_lib_theme_applyaccent, src_app_providers_themeprovider_themeprovider, src_app_providers_themeprovider_usethemecontext, src_features_settings_components_appearancescreen_appearancescreen, _roadmap_14_i18n_theme_prefers_color_scheme_listener [EXTRACTED 1.00]
- **i18n bootstrapping pipeline (init first, provide, sync lang)** — src_app_main_tsx_main, src_lib_i18n_i18ninit, src_lib_i18n_synchtmllang, src_app_providers_i18nprovider_i18nprovider, src_types_i18n_d_ts_customtypeoptions, _roadmap_14_i18n_theme_language_detection_chain [EXTRACTED 1.00]
- **Dual persistence of user preferences (theme, accent, language)** — _roadmap_14_i18n_theme_dual_persistence, _roadmap_14_i18n_theme_user_settings, src_lib_theme_persisttheme, src_lib_theme_persistaccent, src_hooks_usetheme_usetheme, src_hooks_uselanguage_uselanguage, index_html_fouc_prevention_script [EXTRACTED 1.00]

## Communities (43 total, 25 thin omitted)

### Community 0 - "Profiles & Privacy Core"
Cohesion: 0.07
Nodes (40): calls table, channels table (broadcast), chat_members table, chat_requests table (history only), chats table (direct group self community_chat), communities table, direct_pair_key determinism, message_receipts table (per-recipient) (+32 more)

### Community 1 - "Stories & Channels System"
Cohesion: 0.08
Nodes (30): extractVideoThumbnail(), MediaPreviewModal, optimizeImage() (client-side WebP compression), uploadToStorage() (lib/upload.ts), VoiceRecorder, AVATAR_GRADIENTS (from Prompt #6 profile lib), channel_followers.muted_until column, Broadcast Channels System (+22 more)

### Community 2 - "Internationalization & Themes"
Cohesion: 0.09
Nodes (30): Prompt #14: Internationalization & Theme System, Accent color system (6 themes), Dual persistence (localStorage + user_settings), Intl-only locale formatters, Language detection priority chain, Locale namespace system (9 namespaces), prefers-color-scheme runtime listener, Theme preference system (light/dark/system) (+22 more)

### Community 3 - "Chat UI & Communities"
Cohesion: 0.11
Nodes (26): Chat View Screen (Prompt #8a), ChatHeader, ChatPage route (_authenticated.chats.$chatId.tsx), Pending Request Read-only Mode, add_chat_members() bulk RPC, AddMembersModal, ChatOptionsMenu, Contact Profile & Chat Settings (Prompt #9) (+18 more)

### Community 4 - "Calls & LiveKit Integration"
Cohesion: 0.10
Nodes (24): ActiveCallModal (voice) component, ActiveVideoCallModal component, Busy Auto-Reject, CallAvatar component, CallControls component, CallProvider (global mount), Call State Machine, callStore (Zustand) (+16 more)

### Community 5 - "Messages, Composer & Reactions"
Cohesion: 0.09
Nodes (22): ChatListItem, Drafts System (silverchat_draft_{chat_id}), formatChatTimestamp, Composer, frimousse (lazy emoji picker dependency), MediaLightbox, MentionAutocomplete, @Mentions System (messages.mentions uuid[]) (+14 more)

### Community 6 - "Authentication & BFF Stack"
Cohesion: 0.11
Nodes (21): LiveKit Cloud (voice and video calls), Magic link authentication, Netlify (frontend hosting), Resend (transactional email), Row Level Security (RLS), SilverChat, Supabase (DB, Auth, Storage, Realtime), db:types schema type generation (+13 more)

### Community 7 - "Chats List & Requests"
Cohesion: 0.11
Nodes (23): Chat Data Model (enriched Chat interface), ChatContextMenu, ChatFilters, Chats List Screen (Prompt #7), ChatsEmptyState, create_self_chat() RPC (referenced from Prompt #3), delete_direct_chat_for_me() RPC, delete_self_chat() RPC (+15 more)

### Community 8 - "Devices, Offline & Security"
Cohesion: 0.10
Nodes (21): IndexedDB Offline Cache (50/chat + 200 chats), message-cache.ts, NotificationPermissionPrompt component, OfflineBanner component, offline-db.ts (IndexedDB schema), outbox.ts (queue processing), push.ts (client subscription helper), useNotificationPermission hook (+13 more)

### Community 9 - "Message Actions Layer"
Cohesion: 0.11
Nodes (23): check_pin_limit() trigger (max 3 pinned), computePeaks() (voicePeaks.ts), Delete For Me / Delete For Everyone, Edit Message (15-min window), actionMatrix.getAvailableActions(), InChatSearch (local-only search), messages.media_peaks column, Message Actions Layer (Prompt #8b) (+15 more)

### Community 10 - "Deployment & Observability"
Cohesion: 0.10
Nodes (20): callFormatter.ts (times, durations), CallsPage component, groupCallsByDay, Migration 0013_calls_enhancements.sql, useCalls hook, Migration 0014_push_triggers.sql, notify_new_call trigger, notify_new_message trigger (+12 more)

### Community 11 - "Storage & Account Lifecycle"
Cohesion: 0.14
Nodes (18): devices table, file_uploads table (metadata decoupled from bucket), handle_new_user() trigger, profiles table, Storage buckets (avatars, chat-media, story-media, channel-media), stories table (24h ephemeral), Storage bucket policies (storage.objects), get_my_storage_usage() RPC (+10 more)

### Community 12 - "Community RPCs & Succession"
Cohesion: 0.15
Nodes (16): chat_members_after_delete trigger (group admin promotion, from #4b-2), LeaveGroupModal, CommunityInfoScreen (/communities/:id/info), create_community_chat() RPC (admin only), create_community() RPC (auto-creates General chat), CreateCommunityChatModal, CreateCommunityModal, delete_community() RPC (owner, hard delete) (+8 more)

### Community 13 - "PWA Install Experience"
Cohesion: 0.40
Nodes (5): InstallButton (header), IOSInstallInstructions component, PWAInstallBanner component, useInstallPrompt hook, useIsIOS hook

### Community 14 - "Design Token System"
Cohesion: 0.33
Nodes (5): Accent tokens (neon set), OKLCH palette (locked design constants), Semantic color mapping, Six accent themes (.theme-* classes), @theme inline Tailwind bridge

### Community 15 - "Workbox Cache Strategies"
Cohesion: 0.50
Nodes (3): manifest.webmanifest, PWA & Offline Support, vite-plugin-pwa config (Workbox)

### Community 16 - "Privacy Visibility Hooks"
Cohesion: 0.50
Nodes (3): PrivacyScreen component (wired), usePrivacySettings hook, VisibilityScreen component (wired)

### Community 18 - "Service Worker Updates"
Cohesion: 0.67
Nodes (3): registerSW.ts (service worker registration), UpdateAvailableBanner component, useServiceWorkerUpdate hook

## Knowledge Gaps
- **105 isolated node(s):** `TanStack Router v1 (SPA mode)`, `OKLCH palette (locked design constants)`, `App-wide accessibility rules`, `message_deletions table (delete for me)`, `channel_followers table` (+100 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 133 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ChannelView (/channels/:channelId)` connect `Messages, Composer & Reactions` to `Stories & Channels System`, `Chat UI & Communities`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `TanStack Router v1 (SPA mode)`, `OKLCH palette (locked design constants)`, `App-wide accessibility rules` to the rest of the system?**
  _105 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Profiles & Privacy Core` be split into smaller, more focused modules?**
  _Cohesion score 0.06968641114982578 - nodes in this community are weakly interconnected._
- **Why does `ChatOptionsMenu` connect `Chat UI & Communities` to `Message Actions Layer`, `Community RPCs & Succession`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `Stories & Channels System` be split into smaller, more focused modules?**
  _Cohesion score 0.08064516129032258 - nodes in this community are weakly interconnected._
- **Why does `Communities System (Prompt #11)` connect `Chat UI & Communities` to `Message Actions Layer`, `Community RPCs & Succession`, `Chats List & Requests`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `Internationalization & Themes` be split into smaller, more focused modules?**
  _Cohesion score 0.09462365591397849 - nodes in this community are weakly interconnected._