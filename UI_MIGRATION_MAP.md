# SilverChat UI Migration Map

Phase 1 inspection — 2026-11-02 (America/Mexico_City). Current checkout: `d8863d1`. **Phase 2.1, Module 1 and the targeted feedback turn completed; review required before Module 2.**

Phase 1 made no source, dependency, configuration, database or reference changes. The Phase 1 inventory below is retained as the baseline; Phase 2 results and touched row statuses are recorded below. App shell/navigation are now verified; all other feature migrations remain pending. Existing `tsconfig.json` edits and the untracked `_ui_reference/` directory are user state and must be preserved.

## 1. Evidence, topology and corrections

- Read `graphify-out/GRAPH_REPORT.md` and `graphify-out/graph.json` first: 393 nodes / 482 edges, report dated 2026-10-21. Despite its root location, this is a `.roadmap` corpus (19 documents), not a complete AST graph of current `src/`. Its shared messaging, auth, privacy, theme and community relationships are architectural guidance, not proof of current implementation.
- Read `_ui_reference/graphify-out/GRAPH_REPORT.md` and `graph.json`: 2,143 nodes / 3,439 edges, report dated 2026-11-02, built from reference commit `a892b9db63dd006416a82bf99a7ecf4f64bcb749`. The copied reference has not been independently verified against that commit. Both graphs include inferred edges; current files were cross-checked for this map.
- Root graph highlights shared Composer/MessageList/MessageBubble/action layers and community reuse. Reference topology centers on ResponsiveShell, ChatRouteShell, ChatLayout, Avatar, SettingsSheet, Communities, Updates and cn. Prototype routes connect those views to mock data; those data paths are not transplantable.
- **`src/styles.css` does not exist.** The active entry is `src/styles/globals.css`, imported by `src/app/main.tsx`; six additional feature sheets live in `src/styles/`. Phase 2 should deliberately establish the requested `src/styles.css` and update the entry import while keeping unmigrated feature CSS working, or retain the current entry path consistently. Do not create an unused parallel theme.
- Current routing is explicitly constructed in `src/app/router.tsx` with createRoute and lazy components. Filenames resemble file routes but are not a reason to copy the reference generated router tree. Preserve current route IDs, guards, search validation, redirects and history.
- Inventory: **148 current TSX files**, **23 direct client imports under routes/features**, plus `src/app/connection-banner.tsx` and `src/lib/auth-provider.tsx`. A health-store import such as useSupabaseHealth in App.tsx is not a direct client leak. Provider data access is separately classified below.
- Current /calls and /profile are placeholder routes rendered by AuthenticatedDestination in `src/app/router.tsx`. Reference calls are mocked; no working call backend should be inferred from the roadmap or silently added in this UI migration.
- Existing useSendMessage, communityApi, useCreateCommunity and useChatUIStore were inspected as extraction patterns. Keep query keys, RPC arguments, optimistic UUIDs and store APIs stable.

## 2. Dependencies & Tailwind v4 delta

### Package comparison

| Package | Current manifest | Reference manifest | Migration treatment |
|---|---|---|---|
| `react` | ^19.3.1 | ^19.2.0 | Keep installed current stack; adapt reference JSX/API usage. |
| `react-dom` | ^19.3.1 | ^19.2.0 | Keep installed current stack; adapt reference JSX/API usage. |
| `@tanstack/react-router` | ^1.170.45 | latest | Keep installed current stack; adapt reference JSX/API usage. |
| `@tanstack/react-query` | ^5.104.5 | ^5.62.0 | Keep installed current stack; adapt reference JSX/API usage. |
| `tailwindcss` | ^4.3.3 | ^4.1.18 | Keep installed current stack; adapt reference JSX/API usage. |
| `@tailwindcss/vite` | ^4.3.3 | ^4.1.18 | Keep installed current stack; adapt reference JSX/API usage. |
| `lucide-react` | ^1.60.0 | ^0.545.0 | Keep installed current stack; adapt reference JSX/API usage. |
| `react-hook-form` | ^7.90.0 | ^7.79.0 | Keep installed current stack; adapt reference JSX/API usage. |
| `@hookform/resolvers` | ^6.0.0 | ^3.9.0 | Keep installed current stack; adapt reference JSX/API usage. |
| `zod` | ^4.6.7 | ^4.4.3 | Keep installed current stack; adapt reference JSX/API usage. |

No icon library is missing: both apps use lucide-react, with different major versions. Check imported icon exports against the installed version during implementation; do not downgrade it or copy the reference lockfile. Existing Zustand, Supabase, frimousse, cropping, compression, focus trapping and linkification remain part of current contracts.

Missing pure-UI dependencies below are based on local manifests and actual static imports. Versions are **reference declarations, not independently verified install recommendations**. Install only dependencies needed by primitives selected in Phase 2.

| Missing package | Reference version | Used by / priority |
|---|---|---|
| `@radix-ui/react-accordion` | ^1.2.14 | Optional; only if used: accordion.tsx |
| `@radix-ui/react-alert-dialog` | ^1.1.17 | Optional; only if used: alert-dialog.tsx |
| `@radix-ui/react-aspect-ratio` | ^1.1.10 | Optional; only if used: aspect-ratio.tsx |
| `@radix-ui/react-avatar` | ^1.2.0 | Optional; only if used: avatar.tsx |
| `@radix-ui/react-checkbox` | ^1.3.5 | Optional; only if used: checkbox.tsx |
| `@radix-ui/react-collapsible` | ^1.1.14 | Optional; only if used: collapsible.tsx |
| `@radix-ui/react-context-menu` | ^2.3.1 | Optional; only if used: context-menu.tsx |
| `@radix-ui/react-dialog` | ^1.1.17 | Initial primitive candidate: CallOverlay.tsx, command.tsx, dialog.tsx, sheet.tsx |
| `@radix-ui/react-dropdown-menu` | ^2.1.18 | Initial primitive candidate: dropdown-menu.tsx |
| `@radix-ui/react-hover-card` | ^1.1.17 | Initial primitive candidate: hover-card.tsx |
| `@radix-ui/react-label` | ^2.1.10 | Initial primitive candidate: form.tsx, label.tsx |
| `@radix-ui/react-menubar` | ^1.1.18 | Optional; only if used: menubar.tsx |
| `@radix-ui/react-navigation-menu` | ^1.2.16 | Optional; only if used: navigation-menu.tsx |
| `@radix-ui/react-popover` | ^1.1.17 | Initial primitive candidate: popover.tsx |
| `@radix-ui/react-progress` | ^1.1.10 | Optional; only if used: progress.tsx |
| `@radix-ui/react-radio-group` | ^1.4.1 | Optional; only if used: radio-group.tsx |
| `@radix-ui/react-scroll-area` | ^1.2.12 | Optional; only if used: scroll-area.tsx |
| `@radix-ui/react-select` | ^2.3.1 | Optional; only if used: select.tsx |
| `@radix-ui/react-separator` | ^1.1.10 | Initial primitive candidate: separator.tsx |
| `@radix-ui/react-slider` | ^1.4.1 | Optional; only if used: slider.tsx |
| `@radix-ui/react-slot` | ^1.3.0 | Initial primitive candidate: breadcrumb.tsx, button.tsx, form.tsx, sidebar.tsx |
| `@radix-ui/react-switch` | ^1.3.1 | Initial primitive candidate: switch.tsx |
| `@radix-ui/react-tabs` | ^1.1.15 | Optional; only if used: tabs.tsx |
| `@radix-ui/react-toggle` | ^1.1.12 | Optional; only if used: toggle.tsx |
| `@radix-ui/react-toggle-group` | ^1.1.13 | Optional; only if used: toggle-group.tsx |
| `@radix-ui/react-tooltip` | ^1.2.10 | Optional; only if used: tooltip.tsx |
| `class-variance-authority` | ^0.7.1 | Initial primitive candidate: alert.tsx, badge.tsx, button.tsx, label.tsx, navigation-menu.tsx, sheet.tsx, sidebar.tsx, toggle-group.tsx, toggle.tsx |
| `clsx` | ^2.1.1 | Initial primitive candidate: utils.ts |
| `cmdk` | ^1.1.1 | Optional; only if used: command.tsx |
| `embla-carousel-react` | ^8.6.0 | Optional; only if used: carousel.tsx |
| `input-otp` | ^1.4.2 | Optional; only if used: input-otp.tsx |
| `react-day-picker` | ^9.14.0 | Optional; only if used: calendar.tsx |
| `react-resizable-panels` | **Not declared in reference** | Optional; only if used: resizable.tsx |
| `recharts` | ^2.15.4 | Optional; only if used: chart.tsx |
| `sonner` | ^2.0.7 | Optional; only if used: ChatHeaderMenu.tsx, InstallPwaButton.tsx, sonner.tsx, useChatMessages.ts |
| `tailwind-merge` | ^3.6.0 | Initial primitive candidate: utils.ts |
| `vaul` | ^1.1.2 | Optional; only if used: drawer.tsx |
| `tw-animate-css` | `^1.4.0` | Required if retaining reference CSS import and animation classes. |
| `@tailwindcss/typography` | `^0.5.16` | Required if retaining reference @plugin directive; verify need before adding. |

- Reference resizable.tsx imports react-resizable-panels, absent from **both** manifests. It is not required by ResponsiveSplit; defer this unused primitive rather than copying a broken import.
- Reference declares @daypicker/react, umbrella radix-ui, and react-is; no direct static imports were found for those packages in its source. Do not install the entire prototype manifest.
- Reference localization uses i18next, react-i18next, and i18next-browser-languagedetector, absent in current dependencies. Adapt visible strings to existing useI18n, useChatText, and useMessageText; replacing localization/persistence is outside the visual transplant.
- Do not add @tanstack/react-start, @tanstack/react-router-ssr-query, Start/router generation/devtools tooling, server entry files or Vinxi configuration. Do not replace the current Vite, Netlify, SPA, auth or Query setup. PWA tooling and mock call state are not pure-UI dependencies.

### CSS/token/directive comparison

| Area | Current | Reference / required treatment |
|---|---|---|
| Tailwind | @import "tailwindcss", @theme inline; v4.3.3 ranges | Same v4 architecture, v4.1.18 ranges; retain current tooling. |
| Extra directives | No animation-package import or typography plugin | @import "tw-animate-css"; @plugin "@tailwindcss/typography"; Google Fonts import. |
| Shared palette | Silver/neon OKLCH, semantic colors, 0.875rem base radius, six accent themes | Largely shared; transplant additional semantic mappings, gradients and shadows rather than assuming a wholly different palette. |
| New semantic tokens | No popover/bubble/chart/sidebar bridge in globals | Add popover and foreground, ring-offset-background, bubble-self/other, chart-1..5, full sidebar family and matching --color-* mappings. |
| Radii | sm=.375rem, md=.625rem, xl=1.25rem, 2xl=1.75rem | sm=radius-4px, md=radius-2px, xl=radius+4px, 2xl=radius+8px, new 3xl=+12px and 4xl=+16px; lg unchanged. |
| Gradients/utilities | --gradient-silver and --shadow-silver, mostly component CSS classes | Add --gradient-neon, --shadow-glow; @utility bg-gradient-silver, bg-gradient-neon, shadow-glow, shadow-silver, text-neon; dark silver shadow override. |
| Typography | Inter Variable imported locally in main; explicit --font-sans, line-height 1.6 and cv02/cv03/cv04/cv11 | Reference imports Manrope/Fraunces but does **not** assign either as font-family; body sets cv11/ss01. Verify actual computed reference typography before selecting font changes; do not assume imported fonts are active. |
| Theme selection | data-theme, .theme-*, system fallback updates actual semantic colors | Preserve current theme hook/provider and local/remote persistence. Reference media fallback only defines unrelated sea/lagoon variables; do not replace the working semantic fallback with it. |
| Current-only tokens | --color-neon-magenta, --color-neon-lime, --font-sans, duration/easing tokens | Retain while existing consumers use them; visual token additions must not break unmigrated screens. |
| Global rules | Focus-visible, selection, disabled controls, reduced-motion override; broad header/form/input rules | Reference border defaults, thin scrollbar, 7px WebKit scrollbar and neon hover. Scope/retire broad legacy rules as screens migrate, keeping focus/reduced-motion behavior. |
| Animation | Current shimmer and duration variables | Reference vt-chat-in, 200ms view-transition groups, root snapshot disabled; row transition names plus reference lib/viewTransition.ts behavior must be adapted with reduced-motion and browser fallback. |
| Root sizing | Client mounts at #root | Reference styles html, body, #app; adapt to actual #root, not a nonexistent app mount. |
| Legacy cascade | globals.css, settings.css, chats.css, messages.css, chat-settings.css, communities.css, novedades.css | Feature sheets include unlayered rules that can override Tailwind utilities. Retain until their consumers migrate, then remove/scope obsolete selectors per module. |

The reference also contains a sea/lagoon/sand dark-media token block unrelated to its SilverChat semantic palette. Treat it as unused template residue unless a real consumer is identified. Its hsl(var(--silver-light)/...) background expression in chat JSX wraps an OKLCH token; preserve visual intent with a valid color expression instead of carrying that mismatch forward.

### Foundation results — Phase 2

| ID | Target | Visual source | Status |
|---|---|---|
| F01 | `src/styles/globals.css` (existing entry preserved) | `_ui_reference/src/styles.css` | Verified — globals.css is canonical; semantic tokens, radii, theme-aware utilities, scrollbars and transition CSS established. Phase 2.1 adds static bg-ambient-glow; shadow-glow now composes with focus rings. Mode-invariant primary fill verified; see §13 (mobile search §12). |
| F02 | `src/styles/{settings,chats,messages,chat-settings,communities,novedades}.css` | Reference component utility classes | Verified — all six sheets remain active in the components layer; utilities can override them. Module 1 retires only legacy shell/navigation rules from chats.css into app-shell.css (imported by globals.css). |
| F03 | New/adapted `src/components/ui/{button,input,textarea,dialog,sheet,file-icon-tile}.tsx` | Corresponding `_ui_reference/src/components/ui/` files | Verified — reference-derived button/input/textarea/dialog/sheet plus supporting primitives; selective dependencies installed. Phase 2.1: default Button uses gradient/glow; neon-outline adds translucent accent border and glow; disabled primary/outline suppress glow. Mode-invariant primary fill verified; see §13 (mobile search §12). |
| F04 | Current Modal, CodeInput, InlineError, skeleton and settings row/card wrappers | Reference dialog/input/skeleton + SettingsRow/CardSurface | Verified — compatible Modal/CodeInput/InlineError/AppSkeleton extractions and settings row/card primitives; existing focus and callback behavior retained. Phase 2.1 adds ShellBackdrop and glow gallery examples; native Modal/CodeInput contracts unchanged. Module 2A adds pure conversation header, message surface, date/unread and reaction wrappers (see §11). Mode-invariant primary fill verified; see §13 (mobile search §12). |
| F05 | Avatar/menu/popover/hover-card/switch primitives as consumed | Reference components/chat/Avatar.tsx and components/ui/ | Verified — presentation Avatar with existing privacy adapter; dropdown/popover/hover-card/switch/separator primitives established. Phase 2.1: checked Switch glow, reduced-motion thumb, new Badge with default/neon variants. |
| F06 | Class utility helper if needed | `_ui_reference/src/lib/utils.ts` (clsx + tailwind-merge) | Verified — src/lib/utils.ts exports cn using clsx and tailwind-merge; Phase 2.1 registers custom gradient/ambient utilities as background images so color fallbacks survive merging. |

F01/F03 extension: fixed family tokens in file-icon-tile.css (imported by canonical globals.css), pure FileIconTile and resolveFileType; verified in §14.

## 3. Component & route traceability matrix

**Direct surface** means a corresponding visual surface exists, not that prototype logic is safe to copy. **Partial** means its markup covers only part of the target. **Homologate** means no direct counterpart; listed sources are design primitives. **Infrastructure** rows are preserved dependencies; only their own presentation may be dressed.

Hook/store entries list direct non-React hook imports (including hooks used with generic type arguments or .getState()), plus the explicitly noted audio-store dependency. React state/effect hooks are omitted. A No client result is not clearance to skip Step A: re-audit multi-step logic before editing JSX. Rows describe the original inventory; T106 records its Phase 2 extraction below. T024/T124 are Verified after Module 1; all other feature migrations remain Pending.

| ID | Target File (src/) | Visual Source (_ui_reference/) | Direct Supabase Leak? (Needs Step A) | Consumed Hooks & Stores | Status (Pending / Step A Done / Migrated / Verified) |
|---|---|---|---|---|---|
| T001 | `src/app/App.tsx` | Infrastructure: preserve current implementation; no reference runtime transplant | No direct client | `useAuth`, `useSupabaseHealth` | Pending |
| T002 | `src/app/connection-banner.tsx` | Homologate: `_ui_reference/src/components/ui/alert.tsx` | Yes — Step A before presentation changes | `useI18n`, `useSupabaseHealth` | Pending |
| T003 | `src/app/main.tsx` | Infrastructure: preserve current implementation; no reference runtime transplant | No direct client | Props / React state / child composition | Pending |
| T004 | `src/app/providers/auth-provider.tsx` | Infrastructure: preserve current implementation; no reference runtime transplant | No direct client | Props / React state / child composition | Pending |
| T005 | `src/app/providers/i18n-provider.tsx` | Infrastructure: preserve current implementation; no reference runtime transplant | No direct client | Props / React state / child composition | Pending |
| T006 | `src/app/providers/theme-provider.tsx` | Infrastructure: preserve current implementation; no reference runtime transplant | No direct client | Props / React state / child composition | Pending |
| T007 | `src/app/router.tsx` | Infrastructure: preserve current implementation; no reference runtime transplant | No direct client | `useAuth`, `useRouter` | Pending |
| T008 | `src/features/auth/components.tsx` | Homologate: `_ui_reference/src/components/ui/card.tsx`<br>`_ui_reference/src/components/ui/input.tsx`<br>`_ui_reference/src/components/ui/button.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>Phase 2: leaf primitives extracted/re-exported; AuthFrame, Brand and session route behavior unchanged. Full auth screen homologation still pending. | No direct client | `useAuth`, `useRouter` | Pending |
| T009 | `src/features/auth/email-form.tsx` | Homologate: `_ui_reference/src/components/ui/card.tsx`<br>`_ui_reference/src/components/ui/input.tsx`<br>`_ui_reference/src/components/ui/button.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>No auth/onboarding surface in prototype. | No direct client | `useAuth`, `useForm`, `useRouter` | Pending |
| T010 | `src/features/chat-settings/components/AddMembersModal.tsx` | Homologate: `_ui_reference/src/components/chat/MemberHoverCard.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx` | No direct client | `useAddMembers`, `useAuth`, `useChatUIStore`, `useMessageText` | Pending |
| T011 | `src/features/chat-settings/components/ChatOptionsMenu.tsx` | Partial: `_ui_reference/src/components/chat/ChatHeaderMenu.tsx`<br>`_ui_reference/src/components/ui/dropdown-menu.tsx` | No direct client | `useMessageText` | Pending |
| T012 | `src/features/chat-settings/components/ChatSettingsLayer.tsx` | Partial: `_ui_reference/src/components/chat/ChatHeaderMenu.tsx`<br>`_ui_reference/src/components/chat/UserInfoPopover.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx` | Yes — Step A before presentation changes | `useAuth`, `useChatUIStore`, `useMessageText`, `useQueryClient`, `useRealtimeMessages`, `useRouter` | Pending |
| T013 | `src/features/chat-settings/components/ChatSettingsNotice.tsx` | Homologate: `_ui_reference/src/components/ui/alert.tsx` | No direct client | `useChatUIStore`, `useMessageText` | Pending |
| T014 | `src/features/chat-settings/components/ClearChatModal.tsx` | Partial: `_ui_reference/src/components/chat/DeleteChatDialog.tsx` | No direct client | `useChatUIStore`, `useClearChat`, `useMessageText` | Pending |
| T015 | `src/features/chat-settings/components/ContactProfileModal.tsx` | Partial: `_ui_reference/src/components/chat/UserInfoPopover.tsx`<br>`_ui_reference/src/components/chat/MemberHoverCard.tsx`<br>Full public/contact profile actions require additional layout. | Yes — Step A before presentation changes | `useAction`, `useAuth`, `useAvatarGradient`, `useChatUIStore`, `useContactProfile`, `useMessageText`, `useQueryClient`, `useRouter` | Pending |
| T016 | `src/features/chat-settings/components/GroupMembersList.tsx` | Homologate: `_ui_reference/src/components/chat/MemberHoverCard.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx` | No direct client | `useAuth`, `useChatUIStore`, `useGroupMembers`, `useMessageText` | Pending |
| T017 | `src/features/chat-settings/components/GroupSettingsScreen.tsx` | Homologate: `_ui_reference/src/components/settings/ProfileDetails.tsx`<br>`_ui_reference/src/components/settings/SettingsRow.tsx`<br>`_ui_reference/src/components/communities/Communities.tsx` | No direct client | `useAuth`, `useChatUIStore`, `useGroupSettings`, `useMessageText` | Pending |
| T018 | `src/features/chat-settings/components/LeaveGroupModal.tsx` | Partial: `_ui_reference/src/components/chat/DeleteChatDialog.tsx` | No direct client | `useChatUIStore`, `useLeaveGroup`, `useMessageText` | Pending |
| T019 | `src/features/chat-settings/components/MuteSubmenu.tsx` | Partial: `_ui_reference/src/components/chat/ChatHeaderMenu.tsx`<br>`_ui_reference/src/components/ui/dropdown-menu.tsx` | No direct client | `useMessageText` | Pending |
| T020 | `src/features/chat-settings/components/ReportModal.tsx` | Homologate: `_ui_reference/src/components/ui/dialog.tsx`<br>`_ui_reference/src/components/ui/textarea.tsx` | No direct client | `useChatUIStore`, `useMessageText`, `useReportUser` | Pending |
| T021 | `src/features/chat-settings/components/SharedFilesTab.tsx` | Homologate: `_ui_reference/src/components/chat/AttachmentPreview.tsx`<br>`_ui_reference/src/components/ui/tabs.tsx` | No direct client; download workflow extracted | useSharedFileDownload, useMessageText | Step A Done; file tile and MIME label verified (§14), remaining surface migration pending |
| T022 | `src/features/chat-settings/components/SharedMediaTab.tsx` | Homologate: `_ui_reference/src/components/chat/AttachmentPreview.tsx`<br>`_ui_reference/src/components/ui/tabs.tsx` | No direct client | `useInView`, `useMediaUrl`, `useMessageText` | Pending |
| T023 | `src/features/chat-settings/components/SharedMediaView.tsx` | Homologate: `_ui_reference/src/components/chat/AttachmentPreview.tsx`<br>`_ui_reference/src/components/ui/tabs.tsx` | No direct client | `useChat`, `useMessageText`, `useRouter`, `useSearch`, `useSharedMedia` | Pending |
| T024 | `src/features/chats/components/AppNavigation.tsx` | Migrated: `_ui_reference/src/components/layout/ResponsiveShell.tsx`<br>`_ui_reference/src/components/layout/DesktopNavRail.tsx`<br>`_ui_reference/src/components/layout/MobileTabBar.tsx`<br>Preserve authenticated Outlet, guards, badges and current URLs. | No direct client; Step A completed in hooks/useAppNavigation.ts | `useChatText`, `useAppNavigation` (owns `useChats`, `useChatsRealtime`, draft cleanup and unread aggregation), `useRouterState` | Verified Mode-invariant primary fill verified; see §13 (mobile search §12). |
| T025 | `src/features/chats/components/ChatContextMenu.tsx` | Partial: `_ui_reference/src/components/chat/ChatHeaderMenu.tsx`<br>`_ui_reference/src/components/ui/dropdown-menu.tsx` | No direct client; additive context-menu Select preserves multi-select entry after header removal | `useChatText` | Pending |
| T026 | `src/features/chats/components/ChatFilters.tsx` | Direct surface: `_ui_reference/src/components/chat/ChatFilterBar.tsx` | No direct client | `useChatText` | Pending |
| T027 | `src/features/chats/components/ChatListItem.tsx` | Direct surface: `_ui_reference/src/components/chat/ChatListItem.tsx`<br>`_ui_reference/src/components/chat/ChatListPane.tsx` | No direct client | `useChatText`, `useI18n` | Pending |
| T028 | `src/features/chats/components/ChatSearchBar.tsx` | Direct surface: `_ui_reference/src/components/layout/AppHeader.tsx`<br>`_ui_reference/src/components/layout/PaneHeader.tsx` | No direct client | `useChatText` | Verified |
| T029 | `src/features/chats/components/ChatsEmptyState.tsx` | Partial: `_ui_reference/src/components/chat/ChatList.tsx`<br>`_ui_reference/src/components/chat/ConversationPane.tsx` | No direct client | `useChatText` | Pending |
| T030 | `src/features/chats/components/DeleteChatModal.tsx` | Partial: `_ui_reference/src/components/chat/DeleteChatDialog.tsx` | No direct client | `useChatText` | Pending |
| T031 | `src/features/chats/components/MessageRequestsSection.tsx` | Homologate: `_ui_reference/src/components/chat/ChatListItem.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>No equivalent request/bulk/swipe workflow. | No direct client | `useChatText`, `useRequestMutation`, `useRouter` | Step A Done |
| T032 | `src/features/chats/components/MultiSelectToolbar.tsx` | Homologate: `_ui_reference/src/components/chat/ChatListItem.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>No equivalent request/bulk/swipe workflow. | No direct client | `useChatText` | Pending |
| T033 | `src/features/chats/components/NewChatFAB.tsx` | Partial: `_ui_reference/src/components/layout/FloatingActionButton.tsx`<br>`_ui_reference/src/components/chat/ChatListItem.tsx`<br>Feedback verified: shared squircle FAB, chat-plus icon and preserved direct/group/self-chat actions; dialog presentation otherwise retained. | No — extracted to hooks/useNewChatActions.tsx | `useAction`, `useChatText`, `useQueryClient`, `useRouter` | Step A Done |
| T034 | `src/features/chats/components/SwipeActions.tsx` | Homologate: `_ui_reference/src/components/chat/ChatListItem.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>No equivalent request/bulk/swipe workflow. | No direct client | `useChatText` | Pending |
| T035 | `src/features/communities/components/CommunitiesList.tsx` | Direct surface: `_ui_reference/src/components/communities/Communities.tsx`<br>Reference community channel rows are visual references for real community chats. Feedback: only the existing creation FAB now uses the shared group glyph; list migration remains pending. | No direct client | `useCommunities`, `useMessageText` | Pending |
| T036 | `src/features/communities/components/CommunityCard.tsx` | Direct surface: `_ui_reference/src/components/communities/Communities.tsx`<br>Reference community channel rows are visual references for real community chats. | No direct client | `useCommunityChats`, `useMessageText` | Pending |
| T037 | `src/features/communities/components/CommunityChatHeader.tsx` | Partial: `_ui_reference/src/components/chat/ChatLayout.tsx`<br>`_ui_reference/src/components/chat/ChatHeaderMenu.tsx` | No direct client | `useChatUIStore`, `useMessageText` | Pending |
| T038 | `src/features/communities/components/CommunityChatListItem.tsx` | Direct surface: `_ui_reference/src/components/communities/Communities.tsx`<br>Reference community channel rows are visual references for real community chats. | No direct client | `useMessageText` | Pending |
| T039 | `src/features/communities/components/CommunityChatSidebar.tsx` | Partial: `_ui_reference/src/routes/communities.$communityId.channels.$channelId.tsx`<br>`_ui_reference/src/components/chat/ChatRouteShell.tsx`<br>`_ui_reference/src/components/layout/ResponsiveShell.tsx` | No direct client | `useCommunityChats`, `useMessageText` | Pending |
| T040 | `src/features/communities/components/CommunityChatView.tsx` | Partial: `_ui_reference/src/routes/communities.$communityId.channels.$channelId.tsx`<br>`_ui_reference/src/components/chat/ChatLayout.tsx`<br>Keep community_chat contracts, not prototype channel models. | Yes — Step A before presentation changes | `useAuth`, `useChat`, `useMessageText`, `useQueryClient` | Pending |
| T041 | `src/features/communities/components/CommunityInfoScreen.tsx` | Homologate: `_ui_reference/src/components/settings/ProfileDetails.tsx`<br>`_ui_reference/src/components/settings/SettingsRow.tsx`<br>`_ui_reference/src/components/communities/Communities.tsx` | No direct client | Props / React state / child composition | Pending |
| T042 | `src/features/communities/components/CommunitySettingsActions.tsx` | Homologate: `_ui_reference/src/components/chat/ChatHeaderMenu.tsx`<br>`_ui_reference/src/components/settings/SettingsRow.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx` | No direct client | `useAuth`, `useCommunityChats`, `useDeleteCommunity`, `useLeaveCommunity`, `useMessageText`, `useMuteCommunity` | Pending |
| T043 | `src/features/communities/components/CreateCommunityChatModal.tsx` | Partial: `_ui_reference/src/components/communities/NewCommunityDialog.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx` | No direct client | `useCreateCommunityChat`, `useMessageText`, `useRouter` | Pending |
| T044 | `src/features/communities/components/CreateCommunityModal.tsx` | Direct surface: `_ui_reference/src/components/communities/NewCommunityDialog.tsx`<br>Add existing avatar flow and retry-safe creation state. | Yes — Step A before presentation changes | `useAuth`, `useCreateCommunity`, `useMessageText`, `useQueryClient`, `useRouter` | Pending |
| T045 | `src/features/communities/components/CreationDialog.tsx` | Partial: `_ui_reference/src/components/communities/NewCommunityDialog.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx` | No direct client | Props / React state / child composition | Pending |
| T046 | `src/features/messages/components/AttachmentMenu.tsx` | Homologate: `_ui_reference/src/components/chat/ChatComposer.tsx`<br>`_ui_reference/src/components/ui/dropdown-menu.tsx` | No direct client | `useMessageText` | Pending |
| T047 | `src/features/messages/components/ChatHeader.tsx` | Partial: `_ui_reference/src/components/chat/ChatLayout.tsx`<br>`_ui_reference/src/components/chat/ChatHeaderMenu.tsx` | No direct client | `useChatPresence`, `useChatUIStore`, `useMessageText`, `useRouter` | Verified — Module 2A silver header; presence/settings/search contracts retained Primary-fill/mobile-search polish verified; see §12. |
| T048 | `src/features/messages/components/Composer.tsx` | Partial: `_ui_reference/src/components/chat/ChatComposer.tsx`<br>Reference composer only sends text; retain all current tools. | No direct client; Step A completed in dedicated hook (see §11) | useComposerController | Step A Done — useComposerController; presentation deferred to 2B |
| T049 | `src/features/messages/components/ContactPicker.tsx` | Homologate: `_ui_reference/src/components/ui/dialog.tsx`<br>`_ui_reference/src/components/chat/ChatListItem.tsx` | No direct client | `useChats`, `useMessageText` | Pending |
| T050 | `src/features/messages/components/DateSeparator.tsx` | Partial: `_ui_reference/src/components/chat/ChatLayout.tsx`<br>Use timeline/date separator markup; retain pagination, read tracking and scroll behavior. | No direct client | `useMessageText` | Verified — shared TimelineDate |
| T051 | `src/features/messages/components/DeleteMessageModal.tsx` | Partial: `_ui_reference/src/components/chat/DeleteChatDialog.tsx` | No direct client | `useMessageText` | Pending |
| T052 | `src/features/messages/components/EditMessageModal.tsx` | Homologate: `_ui_reference/src/components/ui/dialog.tsx`<br>`_ui_reference/src/components/chat/AttachmentPreview.tsx` | No direct client | `useMessageText` | Pending |
| T053 | `src/features/messages/components/EmojiPanel.tsx` | Homologate: `_ui_reference/src/components/chat/ChatLayout.tsx`<br>`_ui_reference/src/components/ui/popover.tsx`<br>No corresponding functional control; compose reference tokens/primitives. | No direct client | `useMessageText` | Pending |
| T054 | `src/features/messages/components/ForwardModal.tsx` | Homologate: `_ui_reference/src/components/ui/dialog.tsx`<br>`_ui_reference/src/components/chat/ChatListItem.tsx` | No direct client | `useChats`, `useMessageText` | Pending |
| T055 | `src/features/messages/components/InChatSearch.tsx` | Homologate: `_ui_reference/src/components/chat/ChatLayout.tsx`<br>`_ui_reference/src/components/ui/popover.tsx`<br>No corresponding functional control; compose reference tokens/primitives. | No direct client | `useMessageText` | Pending |
| T056 | `src/features/messages/components/MediaLightbox.tsx` | Homologate: `_ui_reference/src/components/ui/dialog.tsx`<br>`_ui_reference/src/components/chat/AttachmentPreview.tsx` | No direct client | `useMediaUrl`, `useMessageText` | Pending |
| T057 | `src/features/messages/components/MediaPreviewModal.tsx` | Homologate: `_ui_reference/src/components/ui/dialog.tsx`<br>`_ui_reference/src/components/chat/AttachmentPreview.tsx` | No direct client; Step A completed in dedicated hook (see §11) | useMediaSend, useMessageText | Step A Done — useMediaSend; shared file tile/label verified (§14); remaining presentation deferred to 2B |
| T058 | `src/features/messages/components/MentionAutocomplete.tsx` | Homologate: `_ui_reference/src/components/chat/ChatLayout.tsx`<br>`_ui_reference/src/components/ui/popover.tsx`<br>No corresponding functional control; compose reference tokens/primitives. | No direct client | Props / React state / child composition | Pending |
| T059 | `src/features/messages/components/MessageActionsProvider.tsx` | Homologate: `_ui_reference/src/components/ui/context-menu.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>Retain action matrix and provider contract. | No direct client; Step A completed in dedicated hook (see §11) | useMessageActionsController | Step A Done — useMessageActionsController; menus/modals deferred to 2B |
| T060 | `src/features/messages/components/MessageBubble.tsx` | Partial: `_ui_reference/src/components/chat/MessageBubble.tsx` | No direct client | `useAuth`, `useMessageActionUI`, `useMessageText` | Verified — MessageSurface / BubbleSurface; own glow, neutral incoming, borderless stickers |
| T061 | `src/features/messages/components/MessageContent.tsx` | Partial: `_ui_reference/src/components/chat/MessageBubble.tsx`<br>Retain current content dispatch, links and search semantics. | No direct client | Props / React state / child composition | Verified — 2A content dispatch audited and retained; shared bubble presentation |
| T062 | `src/features/messages/components/MessageContextMenu.tsx` | Homologate: `_ui_reference/src/components/ui/context-menu.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>Retain action matrix and provider contract. | No direct client | `useAuth`, `useMessageText` | Pending |
| T063 | `src/features/messages/components/MessageList.tsx` | Partial: `_ui_reference/src/components/chat/ChatLayout.tsx`<br>Use timeline/date separator markup; retain pagination, read tracking and scroll behavior. | No direct client | `useAuth`, `useMarkAsRead`, `useMessageText`, `useSearchHighlight` | Verified — 2A timeline CSS; pagination/anchors/read tracking retained |
| T064 | `src/features/messages/components/PinnedMessagesBar.tsx` | Homologate: `_ui_reference/src/components/chat/ChatLayout.tsx`<br>`_ui_reference/src/components/ui/popover.tsx`<br>No corresponding functional control; compose reference tokens/primitives. | No direct client | `useMessageActionUI`, `useMessageText`, `usePinnedMessages` | Verified — accent pin bar; navigation/unpin retained |
| T065 | `src/features/messages/components/ReactionsDisplay.tsx` | Homologate: `_ui_reference/src/components/chat/ChatLayout.tsx`<br>`_ui_reference/src/components/ui/popover.tsx`<br>No corresponding functional control; compose reference tokens/primitives. | No direct client | `useAuth`, `useMessageActionUI`, `useMessageText` | Verified — ReactionChip; accent selection, existing reaction actions |
| T066 | `src/features/messages/components/ReactionsPicker.tsx` | Homologate: `_ui_reference/src/components/chat/ChatLayout.tsx`<br>`_ui_reference/src/components/ui/popover.tsx`<br>No corresponding functional control; compose reference tokens/primitives. | No direct client | `useMessageText` | Pending |
| T067 | `src/features/messages/components/ReplyPreview.tsx` | Homologate: `_ui_reference/src/components/chat/ChatLayout.tsx`<br>`_ui_reference/src/components/ui/popover.tsx`<br>No corresponding functional control; compose reference tokens/primitives. | No direct client | `useMessageActionUI`, `useMessageText` | Pending |
| T068 | `src/features/messages/components/ScrollToBottomButton.tsx` | Homologate: `_ui_reference/src/components/chat/ChatLayout.tsx`<br>`_ui_reference/src/components/ui/popover.tsx`<br>No corresponding functional control; compose reference tokens/primitives. | No direct client | `useMessageText` | Verified — neon unread Badge; existing scroll callback |
| T069 | `src/features/messages/components/SearchHighlight.tsx` | Partial: `_ui_reference/src/components/chat/MessageBubble.tsx`<br>Retain current content dispatch, links and search semantics. | No direct client | Props / React state / child composition | Verified — accent navigation highlight; semantics retained |
| T070 | `src/features/messages/components/UnreadMarker.tsx` | Homologate: `_ui_reference/src/components/chat/ChatLayout.tsx`<br>`_ui_reference/src/components/ui/popover.tsx`<br>No corresponding functional control; compose reference tokens/primitives. | No direct client | `useMessageText` | Verified — shared TimelineUnread |
| T071 | `src/features/messages/components/VoicePlayer.tsx` | Homologate: `_ui_reference/src/components/chat/MessageBubble.tsx`<br>`_ui_reference/src/components/chat/ChatComposer.tsx`<br>`_ui_reference/src/components/ui/slider.tsx`<br>No functional voice recorder/player counterpart. | No direct client | `useAudioStore (via useVoicePlayback)`, `useMessageText`, `useVoicePlayback` | Pending |
| T072 | `src/features/messages/components/VoiceRecorder.tsx` | Homologate: `_ui_reference/src/components/chat/MessageBubble.tsx`<br>`_ui_reference/src/components/chat/ChatComposer.tsx`<br>`_ui_reference/src/components/ui/slider.tsx`<br>No functional voice recorder/player counterpart. | No direct client; Step A completed in dedicated hook (see §11) | useVoiceSend, useMessageText | Step A Done — useVoiceSend; recorder/player visuals deferred to 2B |
| T073 | `src/features/messages/components/content/AudioMessage.tsx` | Homologate: `_ui_reference/src/components/chat/MessageBubble.tsx`<br>`_ui_reference/src/components/chat/ChatComposer.tsx`<br>`_ui_reference/src/components/ui/slider.tsx`<br>No functional voice recorder/player counterpart. | No direct client | `useInView`, `useMediaUrl`, `useMessageText` | Verified — 2A bubble integration only; VoicePlayer/ref/audioProps unchanged |
| T074 | `src/features/messages/components/content/ContactMessage.tsx` | Homologate: `_ui_reference/src/components/chat/MessageBubble.tsx`<br>`_ui_reference/src/components/chat/AttachmentPreview.tsx` | No direct client | `useMessageText` | Verified — 2A shared bubble/contact surface; privacy adapter retained |
| T075 | `src/features/messages/components/content/FileMessage.tsx` | Partial: `_ui_reference/src/components/chat/AttachmentPreview.tsx` | No direct client | `useMessageText` | Verified — MIME-first semantic file tile and localized type label (§14); useAttachmentDownload preserves downloads |
| T076 | `src/features/messages/components/content/ImageMessage.tsx` | Partial: `_ui_reference/src/components/chat/AttachmentPreview.tsx` | No direct client | `useInView`, `useMediaUrl`, `useMessageText` | Verified — rounded media surface; signed URLs/lightbox trigger retained |
| T077 | `src/features/messages/components/content/LocationMessage.tsx` | Homologate: `_ui_reference/src/components/chat/MessageBubble.tsx`<br>`_ui_reference/src/components/chat/AttachmentPreview.tsx` | No direct client | `useMessageText` | Verified — inset location surface; validation/safe link retained |
| T078 | `src/features/messages/components/content/StickerMessage.tsx` | Homologate: `_ui_reference/src/components/chat/MessageBubble.tsx`<br>`_ui_reference/src/components/chat/AttachmentPreview.tsx` | No direct client | `useInView`, `useMediaUrl`, `useMessageText` | Verified — borderless sticker surface; signed media retained |
| T079 | `src/features/messages/components/content/SystemMessage.tsx` | Partial: `_ui_reference/src/components/chat/MessageBubble.tsx`<br>Retain current content dispatch, links and search semantics. | No direct client | Props / React state / child composition | Verified — neutral system pill; content semantics retained |
| T080 | `src/features/messages/components/content/TextMessage.tsx` | Partial: `_ui_reference/src/components/chat/MessageBubble.tsx`<br>Retain current content dispatch, links and search semantics. | No direct client | Props / React state / child composition | Verified — shared bubble typography; text semantics retained |
| T081 | `src/features/messages/components/content/VideoMessage.tsx` | Partial: `_ui_reference/src/components/chat/AttachmentPreview.tsx` | No direct client | `useInView`, `useMediaUrl`, `useMessageText` | Verified — rounded video surface; thumbnail/play trigger retained |
| T082 | `src/features/messages/utils/linkifyText.tsx` | Partial: `_ui_reference/src/components/chat/MessageBubble.tsx`<br>Retain current content dispatch, links and search semantics. | No direct client | Props / React state / child composition | Verified — link/mention semantics audited unchanged inside new bubble surface |
| T083 | `src/features/novedades/components/channels/ChannelComposer.tsx` | Partial: `_ui_reference/src/components/chat/ChatComposer.tsx`<br>Reference composer only sends text; retain all current tools. | No direct client | Props / React state / child composition | Pending |
| T084 | `src/features/novedades/components/channels/ChannelHeader.tsx` | Partial: `_ui_reference/src/components/chat/ChatLayout.tsx`<br>`_ui_reference/src/components/chat/ChatHeaderMenu.tsx`<br>Independent broadcast channels have different owner/follower contracts. | Yes — Step A before presentation changes | `useAuth`, `useChatUIStore`, `useFollowChannel`, `useMessageText`, `useMutation`, `useMuteChannel`, `useQueryClient`, `useRouter`, `useUnfollowChannel` | Pending |
| T085 | `src/features/novedades/components/channels/ChannelInfoScreen.tsx` | Homologate: `_ui_reference/src/components/settings/ProfileDetails.tsx`<br>`_ui_reference/src/components/settings/SettingsRow.tsx` | Yes — Step A before presentation changes | `useAuth`, `useChannelInfo`, `useChatUIStore`, `useFollowChannel`, `useMessageText`, `useMuteChannel`, `useQueryClient`, `useRouter`, `useUnfollowChannel`, `useUpdateChannelInfo` | Pending |
| T086 | `src/features/novedades/components/channels/ChannelListItem.tsx` | Direct surface: `_ui_reference/src/components/updates/Updates.tsx` | No direct client | `useInView`, `useMessageText` | Pending |
| T087 | `src/features/novedades/components/channels/ChannelView.tsx` | Partial: `_ui_reference/src/components/chat/ChatLayout.tsx`<br>`_ui_reference/src/components/chat/ChatHeaderMenu.tsx`<br>Independent broadcast channels have different owner/follower contracts. | Yes — Step A before presentation changes | `useAuth`, `useChannelInfo`, `useChannelMessages`, `useInChatSearch`, `useMessageText`, `useQueryClient`, `useSendMessage` | Pending |
| T088 | `src/features/novedades/components/channels/ChannelsSection.tsx` | Direct surface: `_ui_reference/src/components/updates/Updates.tsx` | No direct client | `useChannels`, `useMessageText` | Pending |
| T089 | `src/features/novedades/components/channels/CreateChannelModal.tsx` | Homologate: `_ui_reference/src/components/communities/NewCommunityDialog.tsx` | Yes — Step A before presentation changes | `useAuth`, `useChatUIStore`, `useCreateChannel`, `useMessageText`, `useQuery`, `useRouter` | Pending |
| T090 | `src/features/novedades/components/channels/DiscoverChannelsSection.tsx` | Direct surface: `_ui_reference/src/components/updates/Updates.tsx` | No direct client | `useDiscoverChannels`, `useFollowChannel`, `useMessageText` | Pending |
| T091 | `src/features/novedades/components/stories/StoriesRow.tsx` | Direct surface: `_ui_reference/src/components/updates/Updates.tsx` | No direct client | `useAuth`, `useMessageText`, `useStories` | Pending |
| T092 | `src/features/novedades/components/stories/StoryCard.tsx` | Direct surface: `_ui_reference/src/components/updates/Updates.tsx` | No direct client | `useAvatarGradient`, `useInView`, `useMediaUrl`, `useMessageText` | Pending |
| T093 | `src/features/novedades/components/stories/StoryCreator.tsx` | Homologate: `_ui_reference/src/components/updates/Updates.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>`_ui_reference/src/components/ui/sheet.tsx`<br>Reference only provides story cards; no creator/viewer/reply lifecycle. | No direct client; Step A: validation/thumbnail/upload/create/abort/cleanup and retry reuse | `useAuth`, `useCreateStory`, `useMessageText`, `useMyStories` | Pending |
| T094 | `src/features/novedades/components/stories/StoryProgressBar.tsx` | Homologate: `_ui_reference/src/components/updates/Updates.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>`_ui_reference/src/components/ui/sheet.tsx`<br>Reference only provides story cards; no creator/viewer/reply lifecycle. | No direct client | Props / React state / child composition | Pending |
| T095 | `src/features/novedades/components/stories/StoryReplyInput.tsx` | Homologate: `_ui_reference/src/components/updates/Updates.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>`_ui_reference/src/components/ui/sheet.tsx`<br>Reference only provides story cards; no creator/viewer/reply lifecycle. | Yes — Step A before presentation changes | `useAuth`, `useChatUIStore`, `useMessageText`, `useQueryClient` | Pending |
| T096 | `src/features/novedades/components/stories/StoryTextEditor.tsx` | Homologate: `_ui_reference/src/components/updates/Updates.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>`_ui_reference/src/components/ui/sheet.tsx`<br>Reference only provides story cards; no creator/viewer/reply lifecycle. | No direct client | `useCreateStory`, `useMessageText` | Pending |
| T097 | `src/features/novedades/components/stories/StoryViewer.tsx` | Homologate: `_ui_reference/src/components/updates/Updates.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>`_ui_reference/src/components/ui/sheet.tsx`<br>Reference only provides story cards; no creator/viewer/reply lifecycle. | No direct client | `useAuth`, `useDeleteStory`, `useMarkStoryViewed`, `useMediaUrl`, `useMessageText`, `useStories`, `useStoryTimer`, `useStoryViewers` | Pending |
| T098 | `src/features/novedades/components/stories/StoryViewersSheet.tsx` | Homologate: `_ui_reference/src/components/updates/Updates.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>`_ui_reference/src/components/ui/sheet.tsx`<br>Reference only provides story cards; no creator/viewer/reply lifecycle. | No direct client | `useMessageText`, `useStoryViewers` | Pending |
| T099 | `src/features/settings/components/AvatarPickerModal.tsx` | Partial: `_ui_reference/src/components/settings/ProfileDetails.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>Photo action sheet only; preserve crop/upload/removal implementation. | No direct client; Step A: crop/save or delegated save -> profile refresh -> cleanup warning | `useAction`, `useAvatarUrl`, `useI18n`, `useProfileRefresh` | Pending |
| T100 | `src/features/settings/components/BlockUserModal.tsx` | Homologate: `_ui_reference/src/components/ui/dialog.tsx`<br>`_ui_reference/src/components/chat/DeleteChatDialog.tsx` | No direct client; Step A: blockUser -> multi-query invalidation -> close | `useAction`, `useAuth`, `useI18n`, `useQueryClient` | Pending |
| T101 | `src/features/settings/components/DeleteAccountModal.tsx` | Homologate: `_ui_reference/src/components/ui/dialog.tsx`<br>`_ui_reference/src/components/chat/DeleteChatDialog.tsx` | Yes — Step A before presentation changes | `useAction`, `useI18n`, `useProfileRefresh` | Pending |
| T102 | `src/features/settings/components/DisableReadReceiptsModal.tsx` | Homologate: `_ui_reference/src/components/ui/dialog.tsx`<br>`_ui_reference/src/components/chat/DeleteChatDialog.tsx` | No direct client | `useAction`, `useI18n`, `usePreferences` | Pending |
| T103 | `src/features/settings/components/LogoutConfirmModal.tsx` | Homologate: `_ui_reference/src/components/ui/dialog.tsx`<br>`_ui_reference/src/components/chat/DeleteChatDialog.tsx` | No direct client | `useAction`, `useAuth`, `useI18n`, `useRouter` | Pending |
| T104 | `src/features/settings/components/ManageExclusionsModal.tsx` | Homologate: `_ui_reference/src/components/ui/dialog.tsx`<br>`_ui_reference/src/components/chat/DeleteChatDialog.tsx` | No direct client | `useAction`, `useContacts`, `useI18n`, `usePreferences` | Pending |
| T105 | `src/features/settings/components/PendingDeletionBanner.tsx` | Homologate: `_ui_reference/src/components/ui/alert.tsx` | Yes — Step A before presentation changes | `useAction`, `useI18n`, `useProfile`, `useProfileRefresh` | Pending |
| T106 | `src/features/settings/components/shared.tsx` | Partial: `_ui_reference/src/components/settings/SettingsRow.tsx`<br>`_ui_reference/src/components/settings/SettingsSheet.tsx`<br>`_ui_reference/src/components/chat/Avatar.tsx`<br>`_ui_reference/src/components/ui/skeleton.tsx`<br>Phase 2: hooks extracted; Avatar and SettingRow use new presentation primitives. SettingsPage/Toggle/QueryState retain current layouts. | No — extracted to settings/hooks/useAvatar.ts and useAction.tsx | `useI18n`, `useInView`, `useRouter`, `useAvatarGradient`, `useAvatarUrl` | Step A Done |
| T107 | `src/features/settings/preferences-provider.tsx` | Infrastructure: preserve current implementation; no reference runtime transplant | Yes — data provider; preserve contract, extract only if changing its implementation | `useAuth`, `useI18n`, `useQuery`, `useQueryClient`, `useTheme` | Pending |
| T108 | `src/lib/auth-provider.tsx` | Infrastructure: preserve current implementation; no reference runtime transplant | Yes — data provider; preserve contract, extract only if changing its implementation | `useQueryClient` | Pending |
| T109 | `src/routes/_authenticated.channels.$channelId.info.tsx` | Homologate: `_ui_reference/src/components/settings/ProfileDetails.tsx`<br>`_ui_reference/src/components/settings/SettingsRow.tsx` | No direct client | `useParams` | Pending |
| T110 | `src/routes/_authenticated.channels.$channelId.tsx` | Partial: `_ui_reference/src/components/chat/ChatLayout.tsx`<br>`_ui_reference/src/components/chat/ChatHeaderMenu.tsx`<br>Independent broadcast channels have different owner/follower contracts. | No direct client | `useParams` | Pending |
| T111 | `src/routes/_authenticated.chats.$chatId.info.tsx` | Homologate: `_ui_reference/src/components/settings/ProfileDetails.tsx`<br>`_ui_reference/src/components/settings/SettingsRow.tsx`<br>`_ui_reference/src/components/communities/Communities.tsx` | No direct client | `useParams` | Pending |
| T112 | `src/routes/_authenticated.chats.$chatId.media.tsx` | Homologate: `_ui_reference/src/components/chat/AttachmentPreview.tsx`<br>`_ui_reference/src/components/ui/tabs.tsx` | No direct client | `useParams` | Pending |
| T113 | `src/routes/_authenticated.chats.$chatId.members.tsx` | Homologate: `_ui_reference/src/components/chat/MemberHoverCard.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx` | No direct client | `useParams` | Pending |
| T114 | `src/routes/_authenticated.chats.$chatId.tsx` | Partial: `_ui_reference/src/routes/chat.$id.tsx`<br>`_ui_reference/src/components/chat/ChatRouteShell.tsx`<br>`_ui_reference/src/components/chat/ChatLayout.tsx`<br>Conversation export is also reused by community chats. | No direct client; Step A completed in dedicated hook (see §11) | useConversationController, useChat, useParams, useRouter, useSearch | Verified — useConversationController extracted; 2A full-width frame/header integration |
| T115 | `src/routes/_authenticated.chats.new-group.tsx` | Homologate: `_ui_reference/src/components/chat/ChatListItem.tsx`<br>`_ui_reference/src/components/communities/NewCommunityDialog.tsx`<br>No direct/group creation screen in reference. | No direct client | `useAuth`, `useChatText`, `useChatUIStore`, `useCreateGroupChat`, `useDirectContacts`, `useRouter`, `useUserSearch` | Pending |
| T116 | `src/routes/_authenticated.chats.new.tsx` | Homologate: `_ui_reference/src/components/chat/ChatListItem.tsx`<br>`_ui_reference/src/components/communities/NewCommunityDialog.tsx`<br>No direct/group creation screen in reference. | No direct client | `useChatText`, `useChatUIStore`, `useCreateDirectChat`, `useDirectContacts`, `useRouter`, `useUserSearch` | Pending |
| T117 | `src/routes/_authenticated.chats.tsx` | Direct surface: `_ui_reference/src/routes/index.tsx`<br>`_ui_reference/src/components/chat/ChatList.tsx`<br>`_ui_reference/src/components/chat/ChatFilterBar.tsx`<br>Feedback: useChatsPage extraction complete; brand header and search verified. Full chat-list migration still pending. | No direct client | `useAuth`, `useChatFilters`, `useChatMutations`, `useChatText`, `useChats`, `useI18n`, `useMessageRequests`, `useRouter` | Step A Done |
| T118 | `src/routes/_authenticated.communities.$communityId.chats.$chatId.tsx` | Partial: `_ui_reference/src/routes/communities.$communityId.channels.$channelId.tsx`<br>`_ui_reference/src/components/chat/ChatLayout.tsx`<br>Keep community_chat contracts, not prototype channel models. | No direct client | `useParams`, `useSearch` | Pending |
| T119 | `src/routes/_authenticated.communities.$communityId.index.tsx` | Homologate: `_ui_reference/src/components/communities/Communities.tsx`<br>`_ui_reference/src/components/chat/ConversationPane.tsx` | No direct client | `useCommunity`, `useMessageText`, `useParams` | Pending |
| T120 | `src/routes/_authenticated.communities.$communityId.info.tsx` | Homologate: `_ui_reference/src/components/settings/ProfileDetails.tsx`<br>`_ui_reference/src/components/settings/SettingsRow.tsx`<br>`_ui_reference/src/components/communities/Communities.tsx` | No direct client | `useParams` | Pending |
| T121 | `src/routes/_authenticated.communities.$communityId.tsx` | Partial: `_ui_reference/src/routes/communities.$communityId.channels.$channelId.tsx`<br>`_ui_reference/src/components/chat/ChatRouteShell.tsx`<br>`_ui_reference/src/components/layout/ResponsiveShell.tsx` | No direct client | `useCommunity`, `useParams`, `useRouterState` | Pending |
| T122 | `src/routes/_authenticated.communities.tsx` | Direct surface: `_ui_reference/src/components/communities/Communities.tsx`<br>Reference community channel rows are visual references for real community chats. | No direct client | Props / React state / child composition | Pending |
| T123 | `src/routes/_authenticated.novedades.tsx` | Partial: `_ui_reference/src/components/updates/Updates.tsx`<br>Both NovedadesPage and ExploreChannelsPage are exported here. | No direct client | `useMessageText`, `useRouter`, `useSearch` | Pending |
| T124 | `src/routes/_authenticated.tsx` | Migrated: `_ui_reference/src/components/layout/ResponsiveShell.tsx`<br>`_ui_reference/src/components/layout/DesktopNavRail.tsx`<br>`_ui_reference/src/components/layout/MobileTabBar.tsx`<br>Preserve authenticated Outlet, guards, badges and current URLs. | No direct client; pure authentication guard retained, no extraction required | `useAuth`, `useRouterState` | Verified |
| T125 | `src/routes/auth.2fa-verify.tsx` | Homologate: `_ui_reference/src/components/ui/card.tsx`<br>`_ui_reference/src/components/ui/input.tsx`<br>`_ui_reference/src/components/ui/button.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>No auth/onboarding surface in prototype. | No direct client | `useAuth`, `useForm`, `useRouter` | Pending |
| T126 | `src/routes/auth.check-email.tsx` | Homologate: `_ui_reference/src/components/ui/card.tsx`<br>`_ui_reference/src/components/ui/input.tsx`<br>`_ui_reference/src/components/ui/button.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>No auth/onboarding surface in prototype. | No direct client | `useAuth` | Pending |
| T127 | `src/routes/auth.error.tsx` | Homologate: `_ui_reference/src/components/ui/card.tsx`<br>`_ui_reference/src/components/ui/input.tsx`<br>`_ui_reference/src/components/ui/button.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>No auth/onboarding surface in prototype. | No direct client | Props / React state / child composition | Pending |
| T128 | `src/routes/auth.login.tsx` | Homologate: `_ui_reference/src/components/ui/card.tsx`<br>`_ui_reference/src/components/ui/input.tsx`<br>`_ui_reference/src/components/ui/button.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>No auth/onboarding surface in prototype. | No direct client | Props / React state / child composition | Pending |
| T129 | `src/routes/auth.post-login.tsx` | Homologate: `_ui_reference/src/components/ui/card.tsx`<br>`_ui_reference/src/components/ui/input.tsx`<br>`_ui_reference/src/components/ui/button.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>No auth/onboarding surface in prototype. | No direct client | `useAuth`, `useRouter` | Pending |
| T130 | `src/routes/auth.signup.tsx` | Homologate: `_ui_reference/src/components/ui/card.tsx`<br>`_ui_reference/src/components/ui/input.tsx`<br>`_ui_reference/src/components/ui/button.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>No auth/onboarding surface in prototype. | No direct client | Props / React state / child composition | Pending |
| T131 | `src/routes/index.tsx` | Homologate: `_ui_reference/src/components/layout/Header.tsx`<br>`_ui_reference/src/components/ui/card.tsx`<br>Current public landing is not the prototype authenticated index. | No direct client | `useAuth`, `useRouter` | Pending |
| T132 | `src/routes/onboarding.pick-username.tsx` | Homologate: `_ui_reference/src/components/ui/card.tsx`<br>`_ui_reference/src/components/ui/input.tsx`<br>`_ui_reference/src/components/ui/button.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>No auth/onboarding surface in prototype. | Yes — Step A before presentation changes | `useAuth`, `useForm`, `useRouter`, `useWatch` | Pending |
| T133 | `src/routes/onboarding.welcome.tsx` | Homologate: `_ui_reference/src/components/ui/card.tsx`<br>`_ui_reference/src/components/ui/input.tsx`<br>`_ui_reference/src/components/ui/button.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx`<br>No auth/onboarding surface in prototype. | Yes — Step A before presentation changes | `useAuth`, `useRouter`, `useTheme` | Pending |
| T134 | `src/routes/profile.$username.tsx` | Partial: `_ui_reference/src/components/chat/UserInfoPopover.tsx`<br>`_ui_reference/src/components/chat/MemberHoverCard.tsx`<br>Full public/contact profile actions require additional layout. | Yes — Step A before presentation changes | `useAction`, `useAuth`, `useAvatarGradient`, `useI18n`, `useParams`, `useQuery`, `useRouter` | Pending |
| T135 | `src/routes/settings.about.tsx` | Partial: `_ui_reference/src/routes/about.tsx`<br>`_ui_reference/src/components/settings/SettingsRow.tsx`<br>Retain app version/license information, not prototype constants. | No direct client | `useI18n` | Pending |
| T136 | `src/routes/settings.account.tsx` | Homologate: `_ui_reference/src/components/settings/SettingsSheet.tsx`<br>`_ui_reference/src/components/settings/ProfileDetails.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx` | Yes — Step A before presentation changes | `useAction`, `useAuth`, `useI18n`, `useProfile`, `useProfileRefresh`, `useRouter` | Pending |
| T137 | `src/routes/settings.appearance.tsx` | Partial: `_ui_reference/src/components/settings/SettingsSheet.tsx`<br>`_ui_reference/src/components/settings/SettingsRow.tsx` | No direct client | `useAction`, `useI18n`, `usePreferences`, `useTheme` | Pending |
| T138 | `src/routes/settings.devices.tsx` | Homologate: `_ui_reference/src/components/settings/SettingsSheet.tsx`<br>`_ui_reference/src/components/settings/SettingsRow.tsx`<br>Reference has summary rows, not full management screens. | No direct client | `useAction`, `useDeviceList`, `useI18n` | Pending |
| T139 | `src/routes/settings.index.tsx` | Partial: `_ui_reference/src/components/settings/SettingsSheet.tsx`<br>`_ui_reference/src/components/settings/SettingsRow.tsx`<br>Keep URL-based settings pages and history; transplant sheet/card visual language. | No direct client | `useI18n`, `useProfile` | Pending |
| T140 | `src/routes/settings.notifications.tsx` | Partial: `_ui_reference/src/components/settings/SettingsSheet.tsx`<br>`_ui_reference/src/components/settings/SettingsRow.tsx` | No direct client | `useAction`, `useI18n`, `usePreferences` | Pending |
| T141 | `src/routes/settings.privacy.blocked.tsx` | Homologate: `_ui_reference/src/components/settings/SettingsSheet.tsx`<br>`_ui_reference/src/components/settings/SettingsRow.tsx`<br>Reference has summary rows, not full management screens. | Yes — Step A before presentation changes | `useAction`, `useAuth`, `useBlockedUsers`, `useI18n`, `useQueryClient` | Pending |
| T142 | `src/routes/settings.privacy.tsx` | Partial: `_ui_reference/src/components/settings/SettingsSheet.tsx`<br>`_ui_reference/src/components/settings/SettingsRow.tsx` | No direct client | `useAction`, `usePreferences` | Pending |
| T143 | `src/routes/settings.privacy.visibility.tsx` | Partial: `_ui_reference/src/components/settings/SettingsSheet.tsx`<br>`_ui_reference/src/components/settings/SettingsRow.tsx` | No direct client | `useAction`, `useI18n`, `usePreferences` | Pending |
| T144 | `src/routes/settings.profile.social.tsx` | Homologate: `_ui_reference/src/components/settings/SettingsSheet.tsx`<br>`_ui_reference/src/components/settings/ProfileDetails.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx` | Yes — Step A before presentation changes | `useAction`, `useI18n`, `useProfile`, `useProfileRefresh` | Pending |
| T145 | `src/routes/settings.profile.tsx` | Partial: `_ui_reference/src/components/settings/ProfileDetails.tsx` | Yes — Step A before presentation changes | `useForm`, `useI18n`, `useProfile`, `useProfileRefresh`, `useWatch` | Pending |
| T146 | `src/routes/settings.security.tsx` | Homologate: `_ui_reference/src/components/settings/SettingsSheet.tsx`<br>`_ui_reference/src/components/settings/ProfileDetails.tsx`<br>`_ui_reference/src/components/ui/dialog.tsx` | Yes — Step A before presentation changes | `useAuth`, `useBlocker`, `useForm` | Pending |
| T147 | `src/routes/settings.storage.tsx` | Homologate: `_ui_reference/src/components/settings/SettingsSheet.tsx`<br>`_ui_reference/src/components/settings/SettingsRow.tsx`<br>Reference has summary rows, not full management screens. | No direct client | `useI18n`, `useStorageUsage` | Pending |
| T148 | `src/routes/settings.tsx` | Partial: `_ui_reference/src/components/settings/SettingsSheet.tsx`<br>`_ui_reference/src/components/settings/SettingsRow.tsx`<br>Keep URL-based settings pages and history; transplant sheet/card visual language. | No direct client | `useI18n`, `useLocation`, `usePreferences`, `useProfile` | Pending |

### Route identity and reverse mapping

| Current SPA destination | Prototype visual donor | Preservation constraint |
|---|---|---|
| / | No equivalent public landing | Reference routes/index.tsx is an authenticated-style tab dashboard, not the public landing. |
| /chats, /chats/$chatId | Reference index chat tab; /chat/$id | Preserve current URLs, filters/search state, scrollTo, read-only requests and redirects. |
| /communities, /communities/$communityId, /communities/$communityId/chats/$chatId | Communities list; reference /communities/$communityId/channels/$channelId | Donor channel means a community subthread; current community chats and independent broadcast channels are separate contracts. |
| /novedades, /novedades/explore | Updates stories, subscribed channels, discover rows | Two current exports in one route file; keep exploration and creation entry points. |
| /channels/$channelId, /channels/$channelId/info | Partial ChatLayout; no complete info page | Preserve follow/owner permissions and channelMode; never replace with mock community channel state. |
| /channels/new, /channels | No page body; current redirects | Keep redirects to /novedades?create=true and /novedades respectively. |
| /settings/* | SettingsSheet, ProfileDetails, SettingsRow | Prototype sheet has only main/profile views; keep each current deep link and browser history. |
| /profile/$username | UserInfoPopover / MemberHoverCard | Partial donor; retain real public profile query and contact actions. |
| /calls, /profile | Calls / user card visuals only | Existing placeholders in app router; no new call/session backend in this scope. |
| /auth/*, /onboarding/* | No counterpart | Keep safe redirects, MFA/session gates, validation and recovery flows. |

Donor coverage: ResponsiveShell/ChatRouteShell -> authenticated and community layouts; ChatLayout/MessageBubble/AttachmentPreview/ChatComposer -> existing messaging consumers; Communities/NewCommunityDialog -> communities and homologated creation; Updates -> stories/channel lists; SettingsSheet/ProfileDetails/SettingsRow -> URL-based settings; components/ui -> shared primitives. Prototype Calls/CallOverlay/CallLogPreview and InstallPwaButton are not authorization to add mocked capabilities. Reference Header/Footer/Layout variants are visual alternatives, not additional navigation systems to mount simultaneously.

## 4. Step A extraction queue

Each extraction must keep the existing JSX/styles intact, pass the app typecheck, and only then proceed to visual changes. Proposed destinations are feature hooks/ and lib/; reuse existing hooks/APIs before introducing duplicates.

| Target ID | Existing boundary | Required extraction / invariant |
|---|---|---|
| T002 | `src/app/connection-banner.tsx` | Move half-open health probing, focusManager suppression and timer cleanup into a health hook. |
| T012 | `src/features/chat-settings/components/ChatSettingsLayer.tsx` | Move member mute/pin updates, mark_chat_as_unread and refresh/navigation orchestration to chat-settings hooks/lib; preserve store modal union. |
| T015 | `src/features/chat-settings/components/ContactProfileModal.tsx` | Extract self/direct chat creation, in-flight deduplication, cache refresh and navigation; preserve avatar privacy. |
| T024 | `src/features/chats/components/AppNavigation.tsx` | DONE in Module 1: draft cleanup, useChats/useChatsRealtime ownership and unread aggregation -> hooks/useAppNavigation.ts. Original JSX retained for extraction-only app typecheck (passed). Mode-invariant primary fill verified; see §13 (mobile search §12). |
| T033 | `src/features/chats/components/NewChatFAB.tsx` | Extract create_self_chat and chats invalidation; keep existing modal choices. |
| T040 | `src/features/communities/components/CommunityChatView.tsx` | Extract membership/read-cursor data access; retain shared Conversation/header injection. |
| T044 | `src/features/communities/components/CreateCommunityModal.tsx` | Extend hook/lib workflow around existing useCreateCommunity: reuse createdId after partial failure, optional saveGroupAvatar, communityApi.update, refresh and navigate. |
| T084 | `src/features/novedades/components/channels/ChannelHeader.tsx` | Extract mark-unread follower cursor update and action mutation dispatch; retain existing follow/unfollow/mute hooks. |
| T085 | `src/features/novedades/components/channels/ChannelInfoScreen.tsx` | Extract owner-scoped channel deletion and refresh/navigation; retain edit/avatar/follow/mute contracts. |
| T087 | `src/features/novedades/components/channels/ChannelView.tsx` | Extract direct follower/read-cursor data access; preserve channel-mode message sending. |
| T089 | `src/features/novedades/components/channels/CreateChannelModal.tsx` | Extract slug availability and create/avatar/update/navigation; reuse created ID after partial success. |
| T095 | `src/features/novedades/components/stories/StoryReplyInput.tsx` | Extract direct-chat request + story-linked message insert + ambiguous-success reconciliation; preserve IDs and invalidations. |
| T101 | `src/features/settings/components/DeleteAccountModal.tsx` | Extract schedule_account_deletion and profile refresh. |
| T105 | `src/features/settings/components/PendingDeletionBanner.tsx` | Extract cancel_account_deletion and profile refresh. |
| T106 | `src/features/settings/components/shared.tsx` | DONE in Phase 2: useAvatarUrl/useAvatarGradient -> hooks/useAvatar.ts; useAction -> hooks/useAction.tsx. Original JSX retained for extraction-only typecheck (passed) before presentation work. Query keys, timing and outage behavior preserved. |
| T107 | `src/features/settings/preferences-provider.tsx` | Existing data infrastructure: preserve user_settings query, debounced serial save/flush, optimistic state and before-sign-out drain. If changed, separate API/hook without changing provider contract. |
| T108 | `src/lib/auth-provider.tsx` | Existing data infrastructure: preserve auth session, profile reads, presence/device writes, realtime auth and sign-out cleanup; not an ordinary presentation leak. |
| T114 | `src/routes/_authenticated.chats.$chatId.tsx` | **Step A Done (Module 2A)** — Extract reply-draft query/enrichment, send-with-reply clearing and request accept/reject refresh/navigation; keep user/chat/reply cache scope. |
| T132 | `src/routes/onboarding.pick-username.tsx` | Extract availability lookup, profiles write and user refresh; retain validation/error mapping. |
| T133 | `src/routes/onboarding.welcome.tsx` | Extract settings read/write and completion workflow; preserve theme and safe redirects. |
| T134 | `src/routes/profile.$username.tsx` | Extract public profile query and create_direct_chat_request navigation flow. |
| T136 | `src/routes/settings.account.tsx` | Extract cancellation, email-change session workflow and account actions; retain deletion and logout dialogs. |
| T141 | `src/routes/settings.privacy.blocked.tsx` | Extract unblock mutation with query cancellation, optimistic state, rollback and cross-feature invalidations. |
| T144 | `src/routes/settings.profile.social.tsx` | Extract profile social-link persistence and refresh. |
| T145 | `src/routes/settings.profile.tsx` | Extract profile/username checks and writes with refresh; preserve form validation and cooldown behavior. |
| T146 | `src/routes/settings.security.tsx` | Extract MFA enrollment/disable/backup regeneration workflow; preserve aal2 check, hashed-code write, partial-success recovery and navigation blocker. |
| T048 | `src/features/messages/components/Composer.tsx` (no client import) | **Step A Done (Module 2A)** — draft persistence, reply retention and async send reconciliation. |
| T057 | `src/features/messages/components/MediaPreviewModal.tsx` (no client import) | **Step A Done (Module 2A)** — upload -> send; failed outbox retains upload ownership. |
| T059 | `src/features/messages/components/MessageActionsProvider.tsx` (no client import) | **Step A Done (Module 2A)** — action dispatch/error mapping and forwarded-message navigation; extract controller if dressing provider JSX. |
| T072 | `src/features/messages/components/VoiceRecorder.tsx` (no client import) | **Step A Done (Module 2A)** — recording/upload -> enqueue -> cleanup with retry ownership. |
| T093 | `src/features/novedades/components/stories/StoryCreator.tsx` (no client import) | validation/thumbnail/upload/create/abort/cleanup and retry reuse. |
| T099 | `src/features/settings/components/AvatarPickerModal.tsx` (no client import) | crop/save or delegated save -> profile refresh -> cleanup warning. |
| T100 | `src/features/settings/components/BlockUserModal.tsx` (no client import) | blockUser -> multi-query invalidation -> close. |

Simple one-hook mutation followed by closing a dialog is not automatically a complex business workflow. Existing create-community-chat, group-members, request, profile-refresh and preference consumers still need a local Step A check, but their hook-based operations should not be duplicated merely to change markup. MessageActionsProvider extraction is queued conservatively because its JSX and controller currently share a file.

## 5. Unmatched new screens and controls

The following need design homologation; partial donors in the matrix do not provide complete equivalents.

| Area | Current screens/components without a full reference counterpart | Design basis |
|---|---|---|
| Public/auth/onboarding | Landing; all auth.*; username selection/welcome; session-expired, reconnect and MFA recovery states | Reference card/input/button/dialog, silver/neon palette and typography |
| Chat creation/requests | New direct/group/self chat, request acceptance/rejection, multiselect and swipe actions | Chat list rows, FAB, dialog primitives |
| Chat detail management | Group/community info, roster/admin actions, add members, shared media/files, mute/clear/leave/report/block | MemberHoverCard, UserInfoPopover, SettingsRow, dialogs/tabs |
| Message operations | Replies, forwarding, editing, pinning, reactions, search/highlights, retry, unread markers, media preview/lightbox, contact/location/sticker messages | MessageBubble/AttachmentPreview/ChatLayout plus menus/dialogs |
| Audio | Actual recording, waveform, progress, seek, play/pause and failure states | Composer/bubble tokens and slider primitive; retain current audio logic |
| Community management | Community index/empty content, create chat, full information/settings, role/ownership actions and confirmations | Communities list, NewCommunityDialog, settings cards |
| Broadcast channels | Create/edit/delete info, slug lookup, avatar upload, owner/follower view and unread cursor | NewCommunityDialog/ProfileDetails plus channel-flavored ChatLayout |
| Stories | Creator/text editor, full-screen viewer, progress/timer, pause, deletion, replies and viewers sheet | Updates story-card design extended with dialog/sheet primitives |
| Settings/profile | Public profile page; account/deletion/email; social links; devices/revocation; storage detail; blocked contacts/exclusions; MFA/backups; avatar crop/upload; pending deletion | SettingsSheet sections, SettingsRow/CardSurface/ProfileDetails; preserve current detailed flows |
| Infrastructure states | Health/reconnect banners, route errors/not-found, loading/retry/permission-empty states and placeholder destinations | Reference alert/skeleton/card primitives; retain current runtime behavior |

Exact files classified **Homologate** (partial surfaces above may also need new sections):

- T002: `src/app/connection-banner.tsx`
- T008: `src/features/auth/components.tsx`
- T009: `src/features/auth/email-form.tsx`
- T010: `src/features/chat-settings/components/AddMembersModal.tsx`
- T013: `src/features/chat-settings/components/ChatSettingsNotice.tsx`
- T016: `src/features/chat-settings/components/GroupMembersList.tsx`
- T017: `src/features/chat-settings/components/GroupSettingsScreen.tsx`
- T020: `src/features/chat-settings/components/ReportModal.tsx`
- T021: `src/features/chat-settings/components/SharedFilesTab.tsx`
- T022: `src/features/chat-settings/components/SharedMediaTab.tsx`
- T023: `src/features/chat-settings/components/SharedMediaView.tsx`
- T031: `src/features/chats/components/MessageRequestsSection.tsx`
- T032: `src/features/chats/components/MultiSelectToolbar.tsx`
- T034: `src/features/chats/components/SwipeActions.tsx`
- T041: `src/features/communities/components/CommunityInfoScreen.tsx`
- T042: `src/features/communities/components/CommunitySettingsActions.tsx`
- T046: `src/features/messages/components/AttachmentMenu.tsx`
- T049: `src/features/messages/components/ContactPicker.tsx`
- T052: `src/features/messages/components/EditMessageModal.tsx`
- T053: `src/features/messages/components/EmojiPanel.tsx`
- T054: `src/features/messages/components/ForwardModal.tsx`
- T055: `src/features/messages/components/InChatSearch.tsx`
- T056: `src/features/messages/components/MediaLightbox.tsx`
- T057: `src/features/messages/components/MediaPreviewModal.tsx`
- T058: `src/features/messages/components/MentionAutocomplete.tsx`
- T059: `src/features/messages/components/MessageActionsProvider.tsx`
- T062: `src/features/messages/components/MessageContextMenu.tsx`
- T064: `src/features/messages/components/PinnedMessagesBar.tsx`
- T065: `src/features/messages/components/ReactionsDisplay.tsx`
- T066: `src/features/messages/components/ReactionsPicker.tsx`
- T067: `src/features/messages/components/ReplyPreview.tsx`
- T068: `src/features/messages/components/ScrollToBottomButton.tsx`
- T070: `src/features/messages/components/UnreadMarker.tsx`
- T071: `src/features/messages/components/VoicePlayer.tsx`
- T072: `src/features/messages/components/VoiceRecorder.tsx`
- T073: `src/features/messages/components/content/AudioMessage.tsx`
- T074: `src/features/messages/components/content/ContactMessage.tsx`
- T077: `src/features/messages/components/content/LocationMessage.tsx`
- T078: `src/features/messages/components/content/StickerMessage.tsx`
- T085: `src/features/novedades/components/channels/ChannelInfoScreen.tsx`
- T089: `src/features/novedades/components/channels/CreateChannelModal.tsx`
- T093: `src/features/novedades/components/stories/StoryCreator.tsx`
- T094: `src/features/novedades/components/stories/StoryProgressBar.tsx`
- T095: `src/features/novedades/components/stories/StoryReplyInput.tsx`
- T096: `src/features/novedades/components/stories/StoryTextEditor.tsx`
- T097: `src/features/novedades/components/stories/StoryViewer.tsx`
- T098: `src/features/novedades/components/stories/StoryViewersSheet.tsx`
- T100: `src/features/settings/components/BlockUserModal.tsx`
- T101: `src/features/settings/components/DeleteAccountModal.tsx`
- T102: `src/features/settings/components/DisableReadReceiptsModal.tsx`
- T103: `src/features/settings/components/LogoutConfirmModal.tsx`
- T104: `src/features/settings/components/ManageExclusionsModal.tsx`
- T105: `src/features/settings/components/PendingDeletionBanner.tsx`
- T109: `src/routes/_authenticated.channels.$channelId.info.tsx`
- T111: `src/routes/_authenticated.chats.$chatId.info.tsx`
- T112: `src/routes/_authenticated.chats.$chatId.media.tsx`
- T113: `src/routes/_authenticated.chats.$chatId.members.tsx`
- T115: `src/routes/_authenticated.chats.new-group.tsx`
- T116: `src/routes/_authenticated.chats.new.tsx`
- T119: `src/routes/_authenticated.communities.$communityId.index.tsx`
- T120: `src/routes/_authenticated.communities.$communityId.info.tsx`
- T125: `src/routes/auth.2fa-verify.tsx`
- T126: `src/routes/auth.check-email.tsx`
- T127: `src/routes/auth.error.tsx`
- T128: `src/routes/auth.login.tsx`
- T129: `src/routes/auth.post-login.tsx`
- T130: `src/routes/auth.signup.tsx`
- T131: `src/routes/index.tsx`
- T132: `src/routes/onboarding.pick-username.tsx`
- T133: `src/routes/onboarding.welcome.tsx`
- T136: `src/routes/settings.account.tsx`
- T138: `src/routes/settings.devices.tsx`
- T141: `src/routes/settings.privacy.blocked.tsx`
- T144: `src/routes/settings.profile.social.tsx`
- T146: `src/routes/settings.security.tsx`
- T147: `src/routes/settings.storage.tsx`

## 6. Bidirectional contract ledger and verification gates

This is the Phase 1 inventory, not proof of zero functional regression. Before each Step B, capture the touched component props, hook returns, mutations and JSX event bindings; after Step B, trace each to a rendered control/state. A feature is Verified only after both type checks and behavior checks pass.

| Contract family | Existing source of truth | Must remain reachable after transplant |
|---|---|---|
| Auth, routing and providers | src/app/router.tsx, src/app/App.tsx, src/lib/auth-provider.tsx, auth navigation helpers | All SPA paths, lazy route boundaries, protected/MFA/onboarding guards, safe redirects, sign-out/session expiry, provider nesting and query retry/outage behavior. |
| Chats | src/features/chats/hooks/, filters/drafts and context menus | Search/filter query state, archive/pin/mute/unread actions, requests, selection/bulk operations, self/group/direct creation, optimistic cache updates and realtime refresh. |
| Sending/retry | src/features/messages/hooks/useSendMessage.ts, message types/query keys | Full SendInput, same client UUID on ambiguous-success retry, pending/failed outbox ownership, message/channel target and cache invalidation; never replace with prototype local message arrays. |
| Conversation/replies | src/routes/_authenticated.chats.$chatId.tsx (Conversation) | Header injection, reply-draft user/chat/message key, reply restoration and clearing only for completed send, request accept/reject, scrollTo, serial navigation, pinned bar and settings layer. Keep focus behavior currently targeting .composer-input textarea when markup changes. |
| Composer/uploads | Composer, MediaPreviewModal, VoiceRecorder, useUploadProgress/useVoiceRecorder | Draft writer flush, new text surviving delayed sends, mentions/caret, emoji, attachment/contact dialogs, caption, cancellation, thumbnails/peaks, progress/errors and failed-message ownership of uploads. |
| Timeline/content/actions | MessageList, content renderers, MessageActionsProvider, useMessageActions/useReactions | Pagination/scroll anchor/read receipts, retry, deleted/system states, signed media, downloads, linkification, reply navigation, forward/edit/delete/pin/reactions and permission/action matrix. |
| Audio | VoicePlayer -> useVoicePlayback -> src/features/messages/stores/audioStore.ts | One active audio, old audio stop/reset, pause/toggle, seek, metadata/duration/time updates, ended/error state, cleanup on unmount; retain ref and all audioProps. |
| Chat settings store | src/features/chat-settings/stores/uiStore.ts | chatId, modal, notice, open, close, notify; all modal kinds, scoped cleanup and group/community context. |
| Communities | communityApi, community hooks/cache, GroupSettingsScreen reuse | Membership/roles/owner restrictions, create ID reuse on avatar failure, automatic General chat contract, member actions, mute/leave/delete and successor behavior, cache refresh and navigation. |
| Channels | src/features/novedades/hooks/channels/, ChannelView/Header/Info | Independent channel model, follow/unfollow/mute, owner posting/edit/delete, slug validation, read cursor, signed avatars and channel-mode sends. |
| Stories | src/features/novedades/hooks/stories/, creator/viewer/reply components | Upload limits, cancellation/retry reuse, expiration/grouping, read receipts/viewers, timer pause/resume, delete permissions and idempotent story-linked replies. |
| Profile/settings | Current settings hooks, preferences provider, profile/avatar libs | Signed-avatar privacy/expiry, crop/removal/cleanup warnings, optimistic unblock rollback, serial debounced persistence and sign-out flush, profile refresh, cooldown/validation, deletion cancellation and device actions. |
| Security | settings.security and existing auth APIs | MFA aal2 verification, hashed backups only in persistence, partial enrollment recovery, copy/download acknowledgments and navigation blocking while codes are unsaved. |
| Accessibility/responsiveness | Current Modal/focus-trap, labels, focus and reduced-motion CSS | Escape/backdrop/busy-close behavior, nested avatar-modal focus, keyboard menu access, live errors, focus restoration and mobile/desktop reachability. Reference shell breakpoints use md sidebar, lg nav rail and xl optional aside. |

### Critical exported prop names (inspection snapshot)

Names below are extracted from destructured exported function parameters in high-risk surfaces; TypeScript types and behavior remain authoritative. This is a seed for per-module audits, not a replacement for examining callback semantics.

| Target | Export | Existing prop names |
|---|---|---|
| T012 `src/features/chat-settings/components/ChatSettingsLayer.tsx` | `ChatSettingsLoading` | `query` |
| T012 `src/features/chat-settings/components/ChatSettingsLayer.tsx` | `ChatSettingsLayer` | `chat`, `onSearch`, `context` |
| T040 `src/features/communities/components/CommunityChatView.tsx` | `CommunityChatView` | `communityId`, `chatId`, `scrollTo` |
| T043 `src/features/communities/components/CreateCommunityChatModal.tsx` | `CreateCommunityChatModal` | `communityId`, `onClose` |
| T044 `src/features/communities/components/CreateCommunityModal.tsx` | `CreateCommunityModal` | `onClose` |
| T048 `src/features/messages/components/Composer.tsx` | `Composer` | `chat`, `onSend`, `replyTo`, `replyToId`, `onClearReply` |
| T057 `src/features/messages/components/MediaPreviewModal.tsx` | `MediaPreviewModal` | `file`, `chatId`, `channelMode`, `onSend`, `onClose` |
| T059 `src/features/messages/components/MessageActionsProvider.tsx` | `MessageActionsProvider` | `chat`, `messages`, `onReply`, `onNavigate`, `children` |
| T060 `src/features/messages/components/MessageBubble.tsx` | `MessageBubble` | `message`, `chat`, `own`, `grouped`, `showAvatar`, `onMedia`, `onRetry` |
| T063 `src/features/messages/components/MessageList.tsx` | `MessageList` | `chat`, `scrollTo`, `onRetry`, `query`, `navigation`, `channelMode` |
| T071 `src/features/messages/components/VoicePlayer.tsx` | `VoicePlayer` | `id`, `url`, `peaks`, `duration` |
| T072 `src/features/messages/components/VoiceRecorder.tsx` | `VoiceRecorder` | `recorder`, `chatId`, `channelMode`, `onSend`, `onClose` |
| T083 `src/features/novedades/components/channels/ChannelComposer.tsx` | `ChannelComposer` | `channel`, `onSend` |
| T087 `src/features/novedades/components/channels/ChannelView.tsx` | `ChannelView` | `channelId` |
| T095 `src/features/novedades/components/stories/StoryReplyInput.tsx` | `StoryReplyInput` | `story`, `onFocusChange` |
| T097 `src/features/novedades/components/stories/StoryViewer.tsx` | `StoryViewer` | `userId`, `initialStoryIndex`, `onClose` |
| T099 `src/features/settings/components/AvatarPickerModal.tsx` | `AvatarPickerModal` | `profile`, `onClose`, `onSaved`, `onSave` |
| T114 `src/routes/_authenticated.chats.$chatId.tsx` | `Conversation` | `chatId`, `scrollTo`, `Header` |

### Baseline and later acceptance checks

- **Passed during Phase 1:** `pnpm exec tsc --noEmit -p tsconfig.app.json` (exit 0). No source edits preceded this check.
- Root tsconfig.json is a solution file with files: [] and project references. Bare tsc --noEmit is not sufficient evidence that app code was checked. At each Step A gate run the explicit app command above; use `pnpm typecheck` (tsc -b) for all configured projects at module completion.
- No functional/browser tests, backend mutations, dependency installation or visual migration were performed in Phase 1.
- Existing targeted unit suites: tests/auth-bff.test.ts, settings.test.ts, chats.test.ts, messages.test.ts, message-actions.test.ts, chat-settings.test.ts, novedades.test.ts, communities.test.ts. Use relevant suites after logic extraction; pnpm test includes the community suite even though there is no dedicated communities script.
- Existing browser/concurrency harnesses under tests/*-browser.mjs and tests/*-concurrency.mjs provide starting points. Inspect their setup and selectors before use; update UI selectors to the new markup while preserving assertions about outcomes. Verify narrow mobile, tablet and desktop layouts, keyboard interaction, light/dark/accent themes and reduced motion.
- Phase 2 acceptance: one active Tailwind theme entry, selected primitive dependencies only, no SSR artifacts, preserved current infrastructure and successful typecheck.
- Phase 3 order: shell/sidebar -> messaging/audio -> communities/channels -> stories/profile/settings -> unmatched screens. Each module records contracts audited, Step A extraction, Step B donor, checks/results, and only then advances Pending -> Step A Done -> Migrated -> Verified.
- Forbidden donors: reference src/start.ts, src/server.ts, src/routeTree.gen.ts, SSR root shell (HeadContent, Scripts, document wrappers), server functions/loaders, mocked APIs/data/types/stores, mock calls and router-context notification counts. Extract presentational JSX only and reconnect the current contracts.

## 7. Phase 2 handoff (historical)

**Scope completed: F01–F06. Phase 3 has not started.**

### Architectural choices

- Kept globals.css and local Inter; existing theme/provider/persistence code is unchanged. No Google Fonts, sea/lagoon residue, SSR artifacts, mock data, or typography plugin were added.
- Ported semantic popover/bubble/sidebar/chart/ring-offset tokens, reference radius scale, gradients/shadows, scrollbar styling and view-transition CSS. Current duration/easing tokens and semantic system-dark fallback remain. Dark utilities follow data-theme. Tailwind scans src/ rather than the reference/test trees.
- Wrapped all six existing feature sheets in @layer components without changing their declarations. Broad global control rules exclude data-slot primitives. Source diff size largely reflects layer indentation; feature CSS was not removed.
- Established 18 component files in src/components/ui/: button, input, textarea, dialog, sheet, dropdown-menu, popover, hover-card, switch, separator, card, skeleton, avatar, settings-row, modal, code-input, inline-error, app-skeleton. Settings-row also exports CardSurface, SectionHeading and content for SPA links.
- Modal remains native and preserves its public props, nested focus loop, busy Escape handling and trigger restoration. New Radix dialogs/sheets are separate primitives with localized close-label and visibility options. Existing auth imports remain compatible through re-exports.
- T106 Step A completed before JSX changes. Signed avatar hooks and useAction moved into feature hooks with unchanged contracts; Avatar and SettingRow now compose visual primitives. T106 is intentionally Step A Done rather than a claim that all settings presentation has migrated. T008 remains Pending for full auth-screen migration.
- New Avatar is presentation-only and accepts resolved URLs. The existing profile adapter retains viewport/privacy gating, signed query keys and legacy dimensions. Image failures are scoped to the failed URL, permitting a replacement URL to render.

### Installed dependencies

Added only seven Radix packages (dialog, dropdown-menu, hover-card, popover, separator, slot, switch), class-variance-authority, clsx, tailwind-merge, and tw-animate-css. Exact resolved versions are in package.json/pnpm-lock.yaml. Existing dependency resolutions were retained; the lockfile diff is additive. No resizable, charts, calendar, localization, SSR, or PWA packages were installed.

pnpm peers check still reports the existing tsconfck/TypeScript 6 range mismatch and a linkify-react/linkifyjs peer diagnostic (both installed as 4.3.3); these were not introduced by the new UI packages. The current compiler and production build pass.

### Verification completed

| Check | Result |
|---|---|
| Extraction-only pnpm exec tsc --noEmit -p tsconfig.app.json | Passed before any shared JSX changes |
| Final app typecheck | Passed |
| pnpm typecheck (all configured projects) | Passed |
| pnpm test | 69 passed, 0 failed |
| pnpm exec vite build | Passed; no reference SSR dependencies copied |
| Scoped Biome check for touched source/styles/tests | Passed |
| tests/ui-foundation-browser.mjs | Passed in Chromium; cascade, default/submit button behavior, switches, OTP, avatar recovery, native nested focus/busy Escape, Radix focus, keyboard menu, popover/hover card, 12 theme/accent combinations, system fallback, reduced motion, 375/768/1280px bounds |
| tests/settings-browser.mjs | Passed in Chromium; profile save/reload, avatar crop/WebP/upload/removal, social links, theme/language persistence, privacy/exclusions/unblock, devices, account email/deletion, notifications, mobile/storage/about; no page runtime errors |
| Visual review | Desktop light/dark foundation and mobile dark foundation screenshots inspected; existing settings desktop/mobile captures generated |

The existing settings browser fixture had an outdated blocked-user mock: the app now reads user_blocks.blocked_id, while the mock returned an empty array. Updated the test response and made screenshot paths portable; production blocked-user logic was not changed.

Review fixture: /tests/ui-foundation.html on the local Vite server. It has no app route or remote services and is excluded from the production entry. Browser artifacts were saved under node_modules/.cache/ui-foundation/ (untracked/ignored). Usage and contracts are documented in docs/ui-foundation.md.

Per-feature end-to-end behavior and exact screen fidelity remain Phase 3 verification work. Existing tsconfig.json edits and _ui_reference contents remain untouched.

**Phase 2 was reviewed and approved before the work below.**


## 8. Phase 2.1 + Phase 3 Module 1 handoff (historical)

**Completed: glow primitives and authenticated shell/navigation (T024, T124). Stop for review before Module 2.**

### Glow architecture

- Default Button uses bg-gradient-neon + shadow-glow, following the reference logo/active-item treatment. The additive neon-outline variant uses border-neon/60, bg-card/70 and accent text. Disabled controls suppress glow. Existing props, refs, Slot/asChild, native button default type, data-slot, focus and invalid semantics remain.
- Checked Switch uses the same gradient/glow; its thumb respects reduced motion. Badge is a new presentation-only span with default/neon variants. Feature code still owns unread semantics, count capping and localized accessible labels.
- Existing --gradient-neon/--shadow-glow values remain the source of color and intensity. Shadow utility composition retains Tailwind focus rings; cn recognizes all three custom background-image utilities without dropping fallback background colors.
- New bg-ambient-glow utility uses a static radial color-mix of the current accent at 9%. ShellBackdrop exposes a decorative, pointer-transparent top wash over legacy opaque headers without injecting a second header/search. No animation or new dependency.
- The gallery at tests/ui-foundation.html now shows primary, neon-outline, Slot link, disabled primary, checked switch, neon badge and ambient light. There are now 20 UI component files, adding badge.tsx and shell-backdrop.tsx.

### Shell structure and preserved contracts

- Step A: moved existing navigation data subscriptions, optional-storage cleanup and unread reduction unchanged into useAppNavigation.ts; app typecheck passed before editing JSX. The authentication guard was already a pure function and remains byte-for-byte unchanged.
- One semantic nav/list transforms through CSS: five bottom tabs below lg (1024px), a 68px silver rail above it. Active icons and S monogram use reference gradient/glow; rail labels appear on hover or keyboard focus. Added aria-current without changing NavLink SPA/modifier-click behavior.
- Preserved all five URLs (/chats, /novedades, /communities, /calls, /settings), /channels active ownership under Updates, pathname subscriptions, translations, useChats query ownership, useChatsRealtime lifecycle, 99+ capping and full accessible counts. Muted/archived chats and manual unread dots retain their exclusions.
- Preserved authenticated Outlet, useAuth, session-expired handling, safe login/MFA redirects, generated-username onboarding guard, onboarding navigation suppression and loading fallback. PendingDeletionBanner remains functional and sits within the content column so the rail cannot obscure it.
- Ordinary routes retain document scrolling, browser back, URL filters and search state. Fixed conversation/community frames share viewport space with the deletion banner and reserve the bottom tabs; FAB/selection offsets are bridged across tablet widths. This is shell geometry only, not a feature migration.
- Screen headers and md sidebar/xl optional content panes remain owned by their existing feature routes. No unused sidebar/aside or duplicated header/search was mounted; the reference split-pane transplant belongs to the subsequent feature modules. No SSR/Start/router-tree/mock/backend code was copied.
- The narrow shared NavLink addition accepts optional aria-current="page". T106 remains Step A Done; its remaining settings presentation is not marked migrated.

### Verification

| Check | Result |
|---|---|
| Step A extraction-only app typecheck | Passed before JSX edits |
| pnpm exec tsc --noEmit -p tsconfig.app.json | Passed |
| pnpm typecheck | Passed |
| pnpm test | 69 passed; 0 failed |
| pnpm exec vite build | Passed |
| Scoped Biome check | Passed |
| node tests/ui-foundation-browser.mjs | Passed: glow, disabled states, focus-ring composition, Slot, ambient gradient, prior primitive/focus contracts, all 12 accent/theme combinations and responsive bounds |
| node tests/settings-browser.mjs | Passed: full settings regression including theme persistence, modal focus, account deletion/cancellation and banner clearance |
| node tests/chats-browser.mjs | Passed: shell widths 390/767/768/1023/1024/1280/1440, five URLs, active state, keyboard labels, unread exclusions, FAB clearance; conversation height at 390/768/1024; existing filters/search/back, mutations/rollback, drafts, realtime and touch flows |
| Visual inspection | Light/dark gallery, desktop rail, tablet tabs and mobile dark shell inspected; no browser runtime errors |

Browser harnesses use mocked HTTP/Realtime boundaries and local Chrome, not real accounts. A pre-existing Vite process on 5173 served stale CSS; validation used a fresh isolated Vite server on 5174 with UI_BASE_URL. Both existing application harnesses now accept that optional base URL; chat screenshot paths are portable. Screenshot animations are disabled for reproducible theme captures.

Artifacts: node_modules/.cache/ui-foundation/ — foundation-light-desktop.png, foundation-dark-desktop.png, foundation-dark-mobile.png, silverchat-chats-desktop.png, silverchat-shell-dark-desktop.png, silverchat-shell-tablet.png, silverchat-chats-mobile.png, silverchat-chats-dark.png, and settings desktop/dark/mobile captures. These remain ignored review artifacts. No unresolved failures. Module 2 is not started.

## 9. Feedback turn working rules (CON-006/007/008; historical)

Baseline captured as ff3b4eb (F01-F06, T024/T106/T124). Permanent rules are recorded in AGENTS.md: quality-first scoped work, commits per completed unit, no generated review images. All nine browser harnesses now omit screenshots (including failure captures); assertions and textual diagnostics remain. Syntax checks passed for all nine harnesses. Prior artifact notes above are historical. Future visual acceptance is manual through pnpm dev and devtools.

### Feedback unit: own-bubble luminosity (F01/F04) — Verified

Added accent-aware --gradient-bubble-self/--shadow-bubble-self/--bubble-self-foreground tokens and bubble-self utility. Light uses pale accent fill and softer halo; explicit/system dark uses neon gradient, luminous rim and existing diffuse shadow-glow. New BubbleSurface is presentation-only; other bubbles have no glow. Both fixture swatch and conversation samples consume the same treatment. Existing message features remain outside this unit. App typecheck, scoped Biome and screenshot-free foundation harness passed, including all 12 theme/accent combinations and neutral-counterpart assertions. Manual visual acceptance: /tests/ui-foundation.html, Bubble surfaces and bubble-self tile, light/dark and all accents at 375/768/1280px.

### Feedback Step A (T117/T031/T033) — completed before JSX redesign

Extracted chat-page state/drafts/clock, selection ranges, refresh/pull handlers and deletion reconciliation into useChatsPage; request accept/decline/error workflows into useMessageRequestActions; self-chat RPC, invalidation and navigation into useNewChatActions. Original presentation retained. App typecheck and scoped lint passed. Full screenshot-free chat regression passed; one timing-dependent context-menu failure exposed the old harness waiting only on refetch, not mutation completion (follow-up synchronization included with the header removal).

### Feedback unit: Chats header/search (F03/F04, T024/T025/T028/T117) — Verified within feedback scope

Added BrandMark/BrandLockup and shared SearchField. Header uses the dynamic-accent white-S tile plus ilver/Chat wordmark, with Chats as a small separate heading. Rail uses the same mark. Removed Select/Refresh header controls at every breakpoint; no PWA placeholder/action added. Search has metallic background, no gray border, and an explicit cyan keyboard/focus indicator; debounce, clear cancellation, limits, archived scope and URL synchronization remain. Context-menu Select seeds the existing URL-based selection/range workflow, keeping bulk actions reachable. Query/mutation completion is exposed through aria-busy, replacing the removed refresh-button synchronization in tests. Fixture includes the same header/search and an accent picker. App typecheck, scoped lint, screenshot-free foundation and full chats harness passed (including 12 logo theme/accent combinations, seven viewport bounds and bulk selection/retries). T117 remains Step A Done because its full list presentation is not claimed migrated.

### Feedback unit: requests closed by default (T031) — Verified within feedback scope

RequestDisclosure starts fully closed, including lists with fewer than four requests and newly mounted incoming lists. It exposes aria-expanded/aria-controls and a keyboard-operable header; previews/actions mount only after opening. Counts, accept/decline, confirmation, busy/errors/notices and navigation remain unchanged. The shared disclosure is also in the fixture. App typecheck, scoped lint and full chats harness passed; foundation keyboard checks cover Enter opening and Space closing. T031 remains Step A Done for the wider presentation migration.

### Feedback unit: tab-specific FAB (F04/T033/T035) — Verified within feedback scope

FloatingActionButton provides chats (square message-plus), calls (phone-plus composition), communities (group), and updates (broadcast) glyphs. Existing Chats and Communities actions use it; Calls is still the existing placeholder, so calls/updates samples are demonstrated in the fixture without adding fake workflows. Tiles use active-accent fill, dark contrasting glyphs, squircle corners and static shadow-glow. There is no border/outline ring, including after mobile modal focus restoration. Keyboard focus increases brightness and glyph stroke instead. Existing props, labels, modal busy/dismissal behavior, self-chat RPC/cache/navigation, and community creation remain. CommunitiesList audit found only hook consumption and local UI state; no Step A workflow extraction required there.

Final verification: app no-emit typecheck passed; pnpm typecheck passed; pnpm test 69/69; Vite production build passed; scoped Biome passed (28 source/style/harness files); screenshot-free foundation, chats, settings and communities browser suites passed. All nine browser harnesses are syntactically valid and contain no screenshot calls. Reduced-motion focus assertions wait for computed state rather than screenshot animation completion. No outstanding functional failures; manual visual acceptance remains with the user.

Working rules are in AGENTS.md. Exact manual routes/states/themes/viewports are in docs/ui-feedback-review.md. No new dependencies, SSR artifacts, database changes or Module 2 migration. Pre-existing tsconfig.json and _ui_reference/ remain excluded from commits.

## 10. Review-path defect repair (F01/F04, T024/T117/T124; T131 remains Pending)

Reproduced plain pnpm dev with no env overrides, canonical/short fixture URLs, file://, logged-out and mocked-session app routes, and a pre-existing server on 5173. The full evidence is in docs/review-path-evidence.md. Bare Vite lacks the Netlify auth backend (POST /api/auth/refresh 404); root/public/auth presentation is not the migrated fixture. Canonical HTTP fixture worked; the short URL fell through to the SPA, file:// was blocked, and the absent favicon emitted a console 404. Silent fallback to 5174 was reproduced; stale CSS itself was not.

Added pnpm review:ui: strict 127.0.0.1:5177, independent cache, .env loading disabled, root/short aliases redirect to the real fixture. Review-only app URLs explain the backend requirement, with no auth bypass or mock account. Plain pnpm dev is strict on 127.0.0.1:5173 and prints the fixture URL plus the backend distinction. Fixture HTML now has its favicon and readable startup fallback. No MPA build entry, feature migration, new dependency or production route changes.

Updated AGENTS.md: CON-007 now requires exactly one final commit per turn; history is preserved. CON-008 now requires executing the documented clean-start user journey. Corrected README and both review docs. New tests/ui-review-path-browser.mjs validates all seven review URLs without auth mocks: actual component markers/styles, redirects, no console/network errors or auth requests; it also verifies the file:// help text. Existing foundation/chats/settings/communities assertions are untouched and passing. All typechecks, 69 unit tests, production build and scoped lint passed. Original tsconfig.json and _ui_reference user state remain excluded.

The current human review procedure is docs/ui-feedback-review.md. No-login visual acceptance uses pnpm review:ui, not the app root or a disk HTML file. Stop for review; Module 2 remains unstarted.

## 11. Phase 3 Module 2A — conversation timeline

### Extraction gate and preserved contracts

All five Step A extractions were completed with the existing JSX intact, then pnpm exec tsc --noEmit -p tsconfig.app.json passed **before** the first presentation edit:

| ID | New hook | Preserved workflow |
|---|---|---|
| T114 | useConversationController | Reply query/enrichment keyed by user/chat/reply, draft restoration, scoped query invalidation, send-with-reply reconciliation, accept/decline, search navigation serials, unavailable redirect |
| T048 | useComposerController | Draft owner/chat scope, pagehide/unmount flush, pending/failed draft retention, mentions/caret, later text/reply surviving an earlier asynchronous send |
| T057 | useMediaSend | Upload then send; cancellation during upload; failed optimistic outbox owns completed upload/thumbnail and retry UUID |
| T059 | useMessageActionsController | Current-message reconciliation, action dispatch/error mapping, reaction guards, navigation callback and forward completion notice |
| T072 | useVoiceSend | Upload with duration/peaks, enqueue ownership boundary, preview/recording cleanup after success or queued failure; upload failures remain recoverable |

No forwarding route transition existed in the provider: it forwards to selected chats and shows a notice. This behavior and onNavigate forwarding remain intact; no new navigation was invented. Public props, Header injection for community conversations, .composer-input textarea focus, scrollTo, route URLs/guards, translations, settings layer, realtime and SendInput are unchanged. useSendMessage, useVoiceRecorder, VoicePlayer, useVoicePlayback and audioStore are untouched. Native audio ref and every audioProps handler remain connected; existing audio-store tests cover exclusive playback, reset and delayed-play cleanup.

### Presentation and scope decisions

Donors: ChatLayout (full-width vertical frame, compact metallic header, date pills), ChatRouteShell (edge-to-edge conversation column), MessageBubble (asymmetric rounded shapes, compact text/metadata), AttachmentPreview (rounded media and document icon tiles). No mock data or prototype hooks were copied into production. The live conversation retains its single route-owned column inside the existing responsive app shell; mounting an additional chat-list sidebar would expand this turn into chat-list migration. Back-to-chats is now reachable at desktop widths as well as mobile.

New pure src/components/ui/conversation-surface.tsx exports ConversationHeaderSurface, MessageSurface, TimelineDate, TimelineUnread and ReactionChip. MessageSurface composes the approved BubbleSurface tokens: light pale accent, dark neon gradient and halo, neutral silver incoming. Sticker surfaces deliberately bypass bubble paint. Existing messages.css read-only selectors now provide timeline spacing, a static 4% accent radial background, media/document/location framing, neutral system pills, accent-selected reactions/pins/navigation highlight. No legacy composer, recorder/player or context-menu styles were redesigned. The attachment preview now starts with an absent URL instead of an empty src, avoiding React warnings and accidental document fetches before its object URL is ready. Content dispatch, safe linkification, signed media visibility gates, downloads, avatars/privacy, retry and lightbox callbacks remain the existing adapters; rows marked Verified through shared styles do not imply a rewritten data adapter.

Fixture: tests/conversation-gallery.tsx, mounted by tests/ui-foundation.tsx at #conversation-gallery. It uses the real pure surfaces and production timeline stylesheet, local mock text and existing favicon artwork. Includes both ownership states for images/audio/deleted, text/reactions, video/file/contact/location/sticker, date/unread/system/highlight/pin states. Audio is a static waveform with no audio element. No auth/data providers or remote services. No screenshots or image artifacts were saved.

### Verification and handoff

- Step A app no-emit typecheck: passed before presentation edits.
- App no-emit typecheck, pnpm typecheck, pnpm test (69 passed), Vite production build and scoped Biome: passed.
- Screenshot-free browser suites: foundation, review path, conversation gallery, messages, message actions, chat settings, communities and novedades/channels passed. Gallery checks all 36 combinations of widths 375/768/1280, light/dark and six accents, plus no clipping, own glow, neutral incoming, borderless stickers, local media and safe links.
- Added browser outcomes for owner-scoped reply restoration and composer focus, newer reply/text surviving delayed completion, failed quote retaining its target/UUID, and completed attachment/voice uploads surviving failed send and reuse on retry. These expanded messaging suites passed. Fixture TypeScript was also checked explicitly.
- Foundation harness now waits for sheet focus restoration before checking the next viewport. Review-path module-entry assertions allow Vite's cache query suffix while checking the exact entry pathname. Original outcome assertions remain.
- Clean isolated review startup used pnpm review:ui --port 5187 because an existing process occupied 5177. Fresh browser contexts verified root/aliases/canonical fixture and the backend-explanation pages, with zero console errors/auth/remote requests. The existing process was left alone. Exact manual journey is in docs/ui-feedback-review.md.

Module 2B remains deferred: composer/tools, recorder/player visuals, context menus and action modals, search UI, media lightbox, reaction picker. User-owned tsconfig.json edits and _ui_reference/ are excluded. One final commit only for this turn; stop for manual visual acceptance.

## 12. Feedback polish — primary fills and mobile search (F01/F03/F04, T024/T033/T047; contrast variants superseded by §13)

The brand and FABs now use bg-gradient-neon. The checked switch, neon badge and active navigation retain gradient fills with explicit mode-aware foreground: exact white in light, near-black in dark; the brand S remains white in both modes. Checked switch thumbs use primary-foreground. All six accent hue pairs remain theme-aware. Renamed --neon-magenta and its Tailwind color mapping to --neon-end everywhere in production; charts also use the renamed endpoint. No compatibility alias is needed because no old consumer remains. The reference checkout is untouched.

Contrast decision: preserve the approved Follow/Light button and logo gradient palette. For white icon controls in light mode, neon-icon-fill derives the two stops with OKLCH lightness capped at 0.60 and chroma at 0.16. Small badge text uses neon-label-fill with lightness 0.52. Both keep the original hue endpoints and existing glow. Dark and system-dark caps become 1, retaining the original bright stops. This intentionally uses the brief's contrast-adjustment allowance; small badge text receives a stronger adjustment than icons.

New screenshot-free tests/primary-fill-browser.mjs checks all logo/FAB/switch/badge/nav samples in twelve mode/accent combinations, white/near-black foregrounds, distinct accent gradients, and 21 resting-state contrast samples per gradient. Minimum light icon/thumb contrast is 3.43:1, light badge text 4.67:1; dark controls/badges 6.01:1. The preserved button/logo palette is not claimed to meet these adjusted-control thresholds. The fixture includes an active Chats navigation sample beside Follow, the neon badge and checked switch.

T047's existing search shortcut is hidden below 768px via a scoped header selector. Desktop markup, width rules and callback remain unchanged. Audit confirmed that ChatSettingsLayer already closes its options menu and calls the same onSearch callback for Search in chat, including self/group/request chat action matrices. No workflow extraction or new search implementation was needed. The authenticated message-actions harness now opens this menu on mobile, searches for text, checks results and dismisses search; its original desktop shortcut test remains. Fixture checks cover 375/767 hidden and 768/1280 visible, with options always visible.

Verification: app no-emit typecheck, pnpm typecheck, 69 unit tests, Vite build and scoped Biome passed. Browser suites passed: primary fills, foundation, conversation gallery, review path, message actions (mobile menu + desktop shortcut), chats and settings. Clean manual review uses pnpm review:ui --port 5187 and fresh browser contexts; the canonical/default 5177 instructions remain documented. Exact manual states, themes, accents and viewports are in docs/ui-feedback-review.md. No screenshots/image artifacts, dependencies, SSR, auth/URL/audio changes or Module 2B work. One final commit; user tsconfig.json and _ui_reference/ remain excluded.

## 13. Fix: identical primary gradients in light and dark (F01/F03/F04, T024/T033)

Computed background-image evidence before editing confirmed both causes across blue/orange/green/purple/red/yellow: neon-icon-fill capped light stops at L <= 0.60 / C <= 0.16 and neon-label-fill at L <= 0.52; additionally the underlying neon/neon-end pair itself differed by mode. For blue the light FAB was oklch(0.6 0.16 255) → oklch(0.6 0.16 210), versus approved dark oklch(0.7 0.22 250) → oklch(0.78 0.2 210). The light logo/Follow pair was oklch(0.62 0.22 255) → oklch(0.7 0.2 210), so deleting the caps alone would leave a mismatch. The same mode-level pattern was measured for all six accents.

The single canonical --gradient-neon now uses --primary-fill-from / --primary-fill-to, declared per accent without mode overrides and copied exactly from the approved pre-fix dark pairs. Dedicated fill stops deliberately preserve existing mode-aware outline/text/glow tokens rather than recoloring other light-mode surfaces. Removed all lightness/chroma caps and alternate gradient definitions. Repurposed neon-icon-fill and neon-label-fill as aliases of the canonical background image, preserving existing consumers without introducing another palette. No foreground, glow, header/search, layout or behavior code changed. Logo S stays white; other primary glyphs remain white in light and near-black in dark.

The existing fixture automatically consumes the corrected CSS. Its harness now asserts every FAB, logo, checked switch, badge, active-nav sample and Follow/Light button has identical computed gradient stops and a matching full gradient in both modes. It also locks the exact approved pre-fix dark stops, across all six accents at 375×844 / 768×1024 / 1280×900, preserving mode-dependent foreground assertions. Foundation checks now verify the actual FAB gradient rather than its optional solid fallback, respecting the user's pre-existing FAB edit.

Measured minimum white glyph/text contrast (21 positions, browser-resolved colors converted to sRGB): blue 1.74:1, orange 2.03:1, green 1.73:1, purple 2.19:1, red 2.37:1, yellow 1.37:1. Dark control minima remain 7.24/8.17/10.94/6.91/6.01/14.13:1 respectively. These lower light ratios are reported, not corrected by altering the explicitly requested fill. Previous light contrast thresholds are intentionally superseded.

Verification: app no-emit typecheck, pnpm typecheck, 69 unit tests, Vite build and scoped Biome passed. Screenshot-free primary-fill, foundation, gallery, review-path, chats, settings and message-actions suites passed. Manual review is back on the free default 5177 port using pnpm review:ui; no 5187 server was started. Clean-start instructions and the per-accent contrast table are in docs/ui-feedback-review.md. No screenshots, new dependencies or Module 2B work. Existing floating-action-button.tsx edits, tsconfig.json edits and _ui_reference/ remain untouched/uncommitted; this fix only commits the shared stylesheet, two harnesses and review/migration docs.

## 14. Vivid file-type tiles (F01/F03, T021/T057/T075)

Shared presentation: src/lib/file-type.ts resolves stored upload MIME first (case/parameters normalized), falling back to the final filename extension only for absent or generic binary MIME. Specific unrecognized MIME stays unknown, even behind a .pdf name. Supported families are PDF/red, spreadsheet/green (xls/xlsx/csv), Word/blue (doc/docx), presentation/orange (ppt/pptx), text-notes/purple (txt/one/md/markdown), and unknown/neutral. English/Spanish labels pass through the existing useMessageText adapter. This reports available metadata, not a content-sniffing or file-safety verdict.

FileIconTile is a decorative 48px circle with matching glyph/tinted fill/1px ring. Its fixed semantic palette has light/dark (including system fallback) values independent of all six accents. Opaque tinted surfaces preserve the family hue on outgoing gradients. Unknown uses white on deep neutral in light and near-black on pale neutral in dark. Existing primary gradients, typography and bubble tokens are unchanged. Installed lucide-react exports verified by app typecheck/build; no dependencies added.

Reused in T075 FileMessage, T021 SharedFilesTab and the document branch of T057 MediaPreviewModal, with size + localized label; shared files retain date. Real download controls already used lucide Download: retained them and corrected the gallery's plain arrow to the same tray icon. Step A moved existing download handlers verbatim into useAttachmentDownload/useSharedFileDownload and passed app tsc before JSX changes. Busy/error/disabled state, popup timing/opener protection, signed URLs, upload ownership/retry and preview callbacks remain intact. T021's broader layout and T057/Module 2B presentation remain deferred.

Gallery now has seven file examples in both directions, including renamed-spreadsheet.pdf metadata mismatch. The screenshot-free harness checks all fourteen tiles at 375×844 / 768×1024 / 1280×900 × light/dark × six accents: independent colors, matching SVG color, unknown foregrounds, circle dimensions/borders, visible labels, tray icons and no clipping. It waits for finite theme transitions before comparing computed styles. Unit coverage adds MIME precedence, generic fallback, extension/MIME normalization, unsupported types, suspicious filenames and bilingual labels. Messaging/shared-files suites assert actual preview/message/list tiles while exercising upload retry and signed download contracts.

Verification: app no-emit tsc, pnpm typecheck, 72 unit tests, Vite production build and scoped Biome pass. All twelve screenshot-free browser suites pass: foundation, review-path, primary-fill, conversation-gallery, messages, chat-settings, message-actions, chats, settings, auth, communities and novedades. Novedades required the existing ffmpeg in-memory video helper outside the sandbox; no review images were created. The broader auth suite exposed an existing clock mismatch (one-minute advance versus 50-minute renewal); only that harness now advances to the scheduled renewal and awaits the 401, with production auth unchanged. Fresh review server/browser verification used default 5177, no auth/remote requests, and no screenshots. Exact manual states are documented in docs/ui-feedback-review.md.

User-owned floating-action-button.tsx and tsconfig.json edits and untracked _ui_reference/ are excluded. No Module 2B work or new dependencies.
