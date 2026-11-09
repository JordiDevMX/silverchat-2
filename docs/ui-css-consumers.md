# CSS consumer inventory — Module 6A

All eight requested sheets, 1,295 selector branches (1,061 distinct selectors within their respective sheets). Each row groups selectors with the same representative consumers. Class evidence comes from class-bearing JSX attributes, utility/variant composition, class assignments and dynamic class families; non-class attributes such as `data-slot` are not treated as CSS classes. For a composite selector, the listed files are examples of where its class tokens are emitted, not a claim that every combination matches every route. Native tag rules use real JSX consumers; base rules and dynamic theme/view-transition selectors name their app entry or theme owner. Conditional, interactive and pseudo-element rules were retained rather than inferred dead from a single rendered state. See the [Module 6A evidence](ui-module-6a.md) for browser verification.

## src/styles/globals.css (108 distinct selectors)

| Consumer examples | Selectors |
|---|---|
| `src/app/providers/theme-provider.tsx`, `src/app/main.tsx` | `:root`, `:root.theme-blue`, `:root.theme-purple`, `:root.theme-red`, `:root.theme-orange`, `:root.theme-yellow`, `:root.theme-green`, `:root[data-theme="dark"]`, `:root[data-theme="dark"].theme-blue`, `:root[data-theme="dark"].theme-purple`, `:root[data-theme="dark"].theme-red`, `:root[data-theme="dark"].theme-orange`, `:root[data-theme="dark"].theme-yellow`, `:root[data-theme="dark"].theme-green`, `:root:not([data-theme])` |
| `src/app/main.tsx`, `src/styles/globals.css` | `*`, `*::before`, `*::after`, `html`, `body`, `#root`, `:focus-visible`, `::selection`, `::-webkit-scrollbar`, `::-webkit-scrollbar-track`, `::-webkit-scrollbar-thumb`, `::-webkit-scrollbar-thumb:hover`, `::view-transition-group(*)`, `::view-transition-old(*)`, `::view-transition-new(*)`, `::view-transition-new(*):only-child` |
| `src/routes/profile.$username.tsx`, `src/routes/_authenticated.chats.new-group.tsx` | `h1` |
| `src/routes/settings.about.tsx`, `src/routes/settings.account.tsx` | `h2` |
| `src/routes/auth.check-email.tsx`, `src/routes/auth.error.tsx` | `p` |
| `src/app/router.tsx`, `src/routes/auth.check-email.tsx` | `a`, `a:hover` |
| `src/routes/settings.tsx`, `src/routes/_authenticated.chats.$chatId.tsx` | `button`, `button:disabled` |
| `src/routes/settings.account.tsx`, `src/routes/settings.privacy.visibility.tsx` | `input`, `input:not([type="checkbox"]):not([data-slot])`, `input::placeholder` |
| `src/routes/onboarding.welcome.tsx`, `src/routes/settings.appearance.tsx` | `select`, `select:not([data-slot])` |
| `src/app/connection-banner.tsx` | `.connection-banner` |
| `src/components/ui/auth-surfaces.tsx` | `.auth-shell`, `.landing`, `.auth-layout`, `.auth-aside`, `.auth-aside svg`, `.auth-aside h2`, `.auth-aside p`, `.auth-aside span`, `.auth-card`, `.auth-card h1`, `.subtitle`, `.landing-main`, `.landing-copy`, `.landing-copy > svg`, `.landing h1`, `.landing-copy > p`, `.landing-actions`, `.conversation-art`, `.conversation-art > svg`, `.conversation-art > span` |
| `src/routes/_authenticated.chats.new-group.tsx`, `src/routes/_authenticated.chats.new.tsx` | `header:not([data-slot])` |
| `src/routes/_authenticated.novedades.tsx`, `src/components/ui/auth-surfaces.tsx` | `footer:not([data-slot])` |
| `src/routes/auth.2fa-verify.tsx`, `src/routes/onboarding.pick-username.tsx` | `form:not([data-slot])`, `label:not([data-slot])` |
| `src/routes/onboarding.welcome.tsx`, `src/routes/settings.privacy.visibility.tsx` | `legend:not([data-slot])` |
| `src/routes/onboarding.pick-username.tsx` | `.input-with-icon`, `.input-with-icon > svg`, `.input-with-icon > span`, `.input-with-icon input` |
| `src/routes/_authenticated.chats.$chatId.tsx` | `.button`, `.button:hover`, `.primary`, `.primary:hover:not(:disabled)`, `.secondary` |
| `src/components/ui/chat-menu-surface.tsx` | `.danger` |
| `src/features/auth/email-form.tsx` | `.form-footer` |
| `src/routes/auth.check-email.tsx` | `.quiet-note` |
| `src/components/ui/inline-error.tsx` | `.form-error` |
| `src/routes/auth.2fa-verify.tsx` | `.feature-icon` |
| `src/components/ui/backup-codes-surface.tsx` | `.button-row`, `.backup-grid` |
| `src/components/ui/modal.tsx` | `.auth-modal`, `.auth-modal::backdrop`, `.auth-modal > * + *`, `.auth-modal h2` |
| `src/routes/settings.security.tsx` | `.security-heading h2`, `.qr-code`, `.setup-key`, `.checkbox-label`, `.checkbox-label input`, `.security-heading`, `.status-badge` |
| `src/components/ui/modal.tsx`, `src/routes/_authenticated.chats.$chatId.tsx` | `.auth-modal .button` |
| `src/components/ui/code-input.tsx` | `.code-field`, `.code-inputs`, `.code-inputs input` |
| `src/routes/onboarding.welcome.tsx` | `.preference-row`, `.accent-options`, `.accent-choice`, `.accent-choice[aria-pressed="true"]` |
| `src/components/ui/app-skeleton.tsx` | `.app-skeleton`, `.skeleton-grid` |
| `src/app/router.tsx` | `.skip-link`, `.skip-link:focus` |

## src/styles/app-shell.css (22 distinct selectors)

| Consumer examples | Selectors |
|---|---|
| `src/routes/_authenticated.tsx` | `.app-shell`, `.app-shell > .authenticated-content` |
| `src/features/chats/components/AppNavigation.tsx` | `.app-navigation`, `.app-monogram`, `.app-nav-divider`, `.app-nav-items`, `.app-nav-items > li`, `.app-nav-link`, `.app-nav-link:focus-visible`, `.app-nav-icon`, `.app-nav-link.active`, `.app-nav-link.active .app-nav-icon`, `.app-nav-link:not(.active):hover .app-nav-icon`, `.app-nav-badge`, `.app-nav-items > li:last-child`, `.app-nav-label`, `.app-nav-link:is(:hover, :focus-visible) .app-nav-label` |
| `src/routes/_authenticated.tsx`, `src/routes/_authenticated.chats.$chatId.tsx`, `src/routes/_authenticated.communities.$communityId.tsx` | `.app-shell > .authenticated-content:has(> :is(.conversation-page, .community-layout))`, `.app-shell > .authenticated-content > :is(.conversation-page, .community-layout)` |
| `src/routes/_authenticated.tsx`, `src/features/settings/components/PendingDeletionBanner.tsx` | `.app-shell .deletion-banner` |
| `src/routes/_authenticated.tsx`, `src/features/chats/components/NewChatFAB.tsx` | `.app-shell .new-chat-fab` |
| `src/routes/_authenticated.tsx`, `src/features/chats/components/MultiSelectToolbar.tsx` | `.app-shell .chat-selection-bar` |

## src/styles/settings.css (250 distinct selectors)

| Consumer examples | Selectors |
|---|---|
| `src/components/ui/settings-surfaces.tsx` | `.settings-shell`, `.settings-topbar`, `.settings-workspace`, `.settings-sidebar`, `:where(.settings-sidebar [data-active="true"]) strong`, `.settings-main`, `.settings-page-heading`, `.settings-page-heading h1`, `.settings-page-heading p`, `.settings-page h2`, `.toggle-row`, `.toggle-row:first-child`, `.toggle-row:last-child`, `.toggle-row strong`, `.toggle-row small`, `.toggle-row input`, `.toggle-row input::after`, `.toggle-row input:checked`, `.toggle-row input:checked::after`, `.toggle-row input:disabled`, `.settings-page fieldset`, `.settings-page legend`, `.settings-page section[id]`, `.settings-shell-v2`, `.settings-shell-v2 .settings-topbar`, `.settings-shell-v2 .settings-workspace`, `.settings-shell-v2 .settings-sidebar`, `.settings-shell-v2 .settings-sidebar nav`, `.settings-shell-v2 .settings-sidebar [aria-current="page"]`, `.settings-shell-v2 a:focus-visible`, `.settings-toggle`, `.settings-toggle > label`, `.settings-toggle strong`, `.settings-toggle small`, `.settings-toggle [data-slot="switch"]`, `.settings-dialog :is(button, input):focus-visible`, `.settings-dialog input[type="search"]`, `.settings-dialog button`, `.settings-dialog input:not([type="checkbox"]):not([type="range"]):not([type="file"])`, `.settings-dialog input[type="range"]`, `.settings-dialog input` |
| `src/routes/settings.tsx` | `.settings-brand`, `.settings-top-profile`, `.settings-sidebar-title`, `.sidebar-foot`, `.setting-row`, `.setting-row:last-child`, `.setting-row:hover`, `.setting-row > svg:last-child`, `.settings-error`, `.settings-error button`, `.settings-top-profile > span:last-child` |
| `src/components/ui/settings-surfaces.tsx`, `src/routes/settings.tsx` | `:where(.settings-sidebar) .setting-row`, `:where(.settings-sidebar .setting-row) strong`, `:where(.settings-sidebar) .setting-row > svg:last-child`, `:where(.settings-sidebar [data-active="true"]) .setting-row`, `.settings-shell-v2 .settings-sidebar-title`, `.settings-shell-v2 .setting-row`, `.settings-shell-v2 .setting-row:active` |
| `src/routes/profile.$username.tsx` | `.settings-back`, `.public-profile-shell`, `.social-pills`, `.social-pills a`, `.social-pills span` |
| `src/components/ui/settings-surfaces.tsx`, `src/routes/_authenticated.chats.$chatId.tsx` | `.settings-page > .button`, `.settings-page .button:disabled` |
| `src/routes/settings.about.tsx` | `.settings-card`, `.settings-card-body`, `.settings-card-body > h2`, `.settings-card-body > p`, `.settings-card select`, `.storage-row`, `.storage-row:last-child`, `.storage-row small`, `.about-identity`, `.about-identity h2`, `.about-identity p` |
| `src/routes/settings.about.tsx`, `src/routes/_authenticated.chats.$chatId.tsx` | `.settings-card-body > .button` |
| `src/routes/settings.index.tsx` | `.profile-card`, `.profile-card h2`, `.profile-card p`, `.settings-logout` |
| `src/components/ui/public-profile-surface.tsx` | `.profile-handle`, `.public-profile-card`, `.public-profile-banner`, `.public-profile-content`, `.public-profile-content h1`, `.profile-bio`, `.public-profile-card-v2`, `.public-profile-card-v2 .public-profile-banner`, `.public-profile-card-v2 .public-profile-content`, `.public-profile-identity`, `.public-profile-identity > :first-child`, `.public-profile-identity > div:last-child`, `.public-profile-card-v2 h1`, `.public-profile-card-v2 .profile-handle`, `.public-profile-card-v2 .profile-bio` |
| `src/routes/settings.index.tsx`, `src/routes/_authenticated.chats.$chatId.tsx` | `.profile-card .button` |
| `src/features/settings/components/shared.tsx` | `.avatar`, `.avatar img` |
| `src/routes/settings.profile.tsx` | `.avatar-small`, `.avatar-medium`, `.avatar-large`, `.form-columns`, `.form-columns input`, `.field-counter`, `.profile-avatar-editor`, `.profile-avatar-editor button`, `.avatar-actions`, `.avatar-crop`, `.avatar-preview` |
| `src/routes/settings.profile.social.tsx` | `.settings-form`, `.settings-form fieldset`, `.settings-form label`, `.settings-form input`, `.settings-form textarea`, `.settings-form input[readonly]`, `.custom-link-row`, `.custom-link-row input`, `.custom-link-row > label:first-child` |
| `src/routes/settings.about.tsx`, `src/components/ui/settings-surfaces.tsx`, `src/routes/settings.privacy.visibility.tsx` | `.settings-card label:not(.toggle-row, .radio-row)` |
| `src/routes/settings.profile.social.tsx`, `src/routes/_authenticated.chats.$chatId.tsx` | `.settings-form > .button`, `.settings-form :where(fieldset) > .button` |
| `src/routes/settings.profile.social.tsx`, `src/routes/settings.tsx` | `.settings-form .setting-row` |
| `src/routes/settings.notifications.tsx` | `.settings-notice` |
| `src/routes/settings.privacy.blocked.tsx` | `.settings-empty`, `.contact-row`, `.contact-row:last-child`, `.contact-row > span`, `.contact-row strong`, `.contact-row small`, `.contact-row input` |
| `src/routes/settings.devices.tsx` | `.device-row`, `.device-row:last-child`, `.device-row > div`, `.device-row strong`, `.device-row small`, `.settings-badge` |
| `src/routes/settings.privacy.blocked.tsx`, `src/routes/_authenticated.chats.$chatId.tsx` | `.contact-row .button` |
| `src/routes/settings.storage.tsx` | `.storage-total h2`, `.storage-total :where(h2) span`, `.storage-total progress`, `.storage-total small` |
| `src/routes/settings.privacy.visibility.tsx` | `.radio-row`, `.radio-row input` |
| `src/features/settings/components/LogoutConfirmModal.tsx` | `.check-row input`, `.check-row` |
| `src/routes/settings.appearance.tsx` | `.theme-options`, `.theme-option`, `.theme-option[aria-pressed="true"]`, `.theme-option > span:last-child`, `.theme-miniature`, `.theme-miniature span`, `.theme-miniature span:nth-child(2)`, `.theme-preview-dark .theme-miniature`, `.theme-preview-dark :where(.theme-miniature) span`, `.theme-preview-system .theme-miniature` |
| `src/routes/onboarding.welcome.tsx` | `.accent-options`, `.accent-swatch`, `.accent-swatch[aria-pressed="true"]` |
| `src/routes/settings.account.tsx` | `.danger-zone`, `.danger-zone h2`, `.modal-actions` |
| `src/routes/settings.account.tsx`, `src/routes/_authenticated.chats.$chatId.tsx` | `.modal-actions .button` |
| `src/features/settings/components/ManageExclusionsModal.tsx` | `.contact-list` |
| `src/routes/settings.profile.tsx`, `src/routes/_authenticated.chats.$chatId.tsx` | `.avatar-actions .button` |
| `src/features/settings/components/PendingDeletionBanner.tsx` | `.deletion-banner`, `.deletion-banner button`, `.deletion-banner [data-slot="button"]` |
| `src/components/ui/public-profile-surface.tsx`, `src/features/settings/components/shared.tsx` | `.public-profile-content > .avatar` |
| `src/routes/settings.index.tsx`, `src/routes/settings.profile.tsx` | `.profile-card .avatar-large` |
| `src/components/ui/settings-surfaces.tsx`, `src/routes/profile.$username.tsx` | `.settings-shell-v2 .settings-back`, `.settings-shell-v2 .settings-back:hover` |
| `src/components/ui/chat-settings-surfaces.tsx` | `.settings-panel`, `.settings-panel > [data-slot="button"]`, `.settings-panel :is(button, input, select, summary):focus-visible`, `.settings-panel progress::-webkit-progress-bar`, `.settings-panel progress::-webkit-progress-value`, `.settings-panel progress::-moz-progress-bar`, `.settings-panel summary`, `.settings-panel details[open] > ul` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/components/ui/settings-surfaces.tsx` | `.settings-panel .settings-page-heading`, `.settings-panel .settings-page-heading h1`, `.settings-panel .settings-page-heading p` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/routes/settings.about.tsx` | `.settings-panel .settings-card`, `.settings-panel .settings-card-body`, `.settings-panel .settings-card-body > h2`, `.settings-panel .storage-row` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/routes/settings.index.tsx` | `.settings-panel .profile-card`, `.settings-panel .profile-card h2` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/routes/settings.tsx` | `.settings-panel .setting-row` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/routes/settings.index.tsx`, `src/routes/settings.profile.tsx` | `.settings-panel .profile-card .avatar-large` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/routes/settings.privacy.visibility.tsx` | `.settings-panel .radio-row`, `.settings-panel .radio-row:hover`, `.settings-panel .radio-row:has(input:checked)` |
| `src/components/ui/settings-surfaces.tsx`, `src/routes/settings.privacy.blocked.tsx` | `.settings-dialog .contact-row:hover`, `.settings-dialog .contact-row` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/routes/settings.appearance.tsx` | `.settings-panel .theme-option`, `.settings-panel .theme-option[aria-pressed="true"]`, `.settings-panel .theme-option:active`, `.settings-panel .theme-miniature span:nth-child(2)` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/routes/onboarding.welcome.tsx` | `.settings-panel .accent-swatch:active`, `.settings-panel .accent-options`, `.settings-panel .accent-swatch`, `.settings-panel .accent-swatch[aria-pressed="true"]` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/routes/settings.devices.tsx` | `.settings-panel .device-row`, `.settings-panel .device-row > svg`, `.settings-panel .settings-badge` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/routes/settings.storage.tsx` | `.settings-panel .storage-total > h2` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/routes/settings.notifications.tsx` | `.settings-panel .settings-notice` |
| `src/components/ui/modal.tsx`, `src/components/ui/settings-surfaces.tsx` | `.auth-modal.settings-dialog`, `.auth-modal.settings-dialog::backdrop`, `.auth-modal.settings-dialog > h2`, `.auth-modal.settings-dialog p` |
| `src/components/ui/modal.tsx`, `src/components/ui/settings-surfaces.tsx`, `src/components/ui/motion-overlay.tsx` | `.auth-modal.settings-dialog .motion-overlay-body`, `.auth-modal.settings-dialog.story-exiting`, `.auth-modal.settings-dialog.story-exiting .motion-overlay-body` |
| `src/components/ui/settings-surfaces.tsx`, `src/routes/settings.account.tsx` | `.settings-dialog .modal-actions`, `.settings-dialog .modal-actions button`, `.settings-dialog .modal-actions [data-slot="button"]` |
| `src/components/ui/settings-surfaces.tsx`, `src/features/settings/components/ManageExclusionsModal.tsx` | `.settings-dialog .contact-list` |
| `src/routes/onboarding.welcome.tsx`, `src/routes/settings.appearance.tsx` | `.accent-swatch.theme-blue`, `.accent-swatch.theme-purple`, `.accent-swatch.theme-red`, `.accent-swatch.theme-orange`, `.accent-swatch.theme-yellow`, `.accent-swatch.theme-green` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/routes/settings.profile.tsx` | `.settings-panel .profile-photo-trigger` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/routes/settings.profile.social.tsx` | `.settings-panel .settings-form :is(input, textarea)`, `.settings-panel .settings-form :is(input, textarea):focus-visible`, `.settings-panel .settings-form input[readonly]` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/routes/settings.profile.social.tsx`, `src/routes/onboarding.pick-username.tsx` | `.settings-panel .settings-form .input-with-icon input` |
| `src/components/ui/settings-surfaces.tsx`, `src/routes/settings.profile.tsx` | `.settings-dialog .avatar-actions`, `.settings-dialog .avatar-actions button`, `.settings-dialog .avatar-crop` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/routes/settings.privacy.blocked.tsx` | `.settings-panel .contact-row`, `.settings-panel .contact-row > span` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/routes/settings.account.tsx` | `.settings-panel .danger-zone`, `.settings-panel .danger-zone h2` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/routes/settings.security.tsx` | `.settings-panel .security-heading`, `.settings-panel .security-heading > svg`, `.settings-panel .security-card > button` |
| `src/components/ui/settings-surfaces.tsx`, `src/components/ui/backup-codes-surface.tsx` | `.settings-dialog .backup-grid`, `.settings-dialog .backup-grid code`, `.settings-dialog .button-row` |
| `src/components/ui/modal.tsx`, `src/components/ui/settings-surfaces.tsx`, `src/routes/settings.security.tsx` | `.auth-modal.settings-dialog .settings-security-lock` |
| `src/components/ui/settings-surfaces.tsx`, `src/routes/settings.security.tsx` | `.settings-dialog .setup-key` |
| `src/components/ui/public-profile-surface.tsx`, `src/routes/profile.$username.tsx` | `.public-profile-card-v2 .social-pills`, `.public-profile-card-v2 .social-pills :is(a, span)`, `.public-profile-card-v2 .social-pills a:hover` |

## src/styles/chats.css (140 distinct selectors)

| Consumer examples | Selectors |
|---|---|
| `src/routes/_authenticated.chats.new-group.tsx` | `:where(.new-chat-search) > button`, `.chats-page`, `.chats-surface`, `.chats-page button`, `.chat-search`, `.chats-empty`, `.chats-empty > svg`, `.chats-empty h2`, `.chats-empty p`, `.chats-error`, `.new-chat-surface`, `.new-chat-header`, `.new-chat-back`, `.new-chat-back:hover`, `.new-chat-header-titles`, `.new-chat-heading`, `.new-chat-alert`, `.new-chat-alert-dismiss`, `.new-chat-section-title`, `.new-chat-user-list`, `.new-chat-empty`, `.new-group-create-btn`, `.new-group-form`, `.new-group-field`, `.new-group-label`, `.new-group-counter`, `.new-group-name-input`, `.new-group-name-input:focus-visible`, `.new-group-members-section`, `.new-group-members-header`, `.new-group-members-header .new-chat-section-title`, `.new-group-selected-count`, `.new-group-chips`, `.new-group-chip`, `.new-group-chip-name`, `.new-group-chip-remove`, `.new-group-chip-remove:hover`, `.new-group-subtitle`, `.new-chat-search`, `.new-chat-search:focus-within`, `.new-chat-search > input`, `.new-chat-search > input:focus-visible`, `.new-chat-search > svg` |
| `src/features/chats/components/ChatsHeader.tsx` | `.chats-header`, `.chats-header .chats-tab-title` |
| `src/features/chats/components/ChatFilters.tsx` | `.chat-filters`, `.chat-filters button`, `.chat-filters button[aria-pressed="true"]`, `.chat-filters button:hover:not([aria-pressed="true"])` |
| `src/routes/_authenticated.chats.tsx` | `.chat-list`, `.chats-notice`, `.chat-pull` |
| `src/features/chats/components/ChatListItemSurface.tsx` | `.chat-list-item`, `.chat-list-item.is-blocked`, `.chat-row`, `.chat-row-main`, `.chat-row-main:hover`, `.is-selected .chat-row-main`, `.chat-avatar`, `.presence-dot`, `.chat-row-copy`, `.chat-name`, `.chat-name strong`, `.chat-name svg`, `.chat-preview`, `.chat-preview svg`, `.receipt-read`, `.draft-pill`, `.chat-row-meta`, `.chat-time`, `.unread-dot`, `.chat-hover-actions`, `.chat-hover-actions button`, `.chat-hover-actions button:hover`, `.chat-row:hover .chat-hover-actions`, `.chat-row:focus-within .chat-hover-actions`, `.chat-hover-actions:focus-within`, `.chat-checkbox`, `.is-selected .chat-checkbox`, `.chat-spin`, `.chat-list-item[data-unread="true"] .chat-name strong`, `.chat-list-item[data-unread="true"] .chat-time`, `.chat-row-main:active`, `.chat-row-main:focus-visible` |
| `src/features/chats/components/ChatListItemSurface.tsx`, `src/features/settings/components/shared.tsx` | `.chat-avatar .avatar` |
| `src/components/ui/settings-surfaces.tsx` | `.preview-text`, `.preview-draft`, `.preview-deleted`, `.preview-failed` |
| `src/features/chats/components/MultiSelectToolbar.tsx` | `.destructive-text`, `.chat-selection-header`, `.chat-selection-header > button:first-child`, `.chat-selection-header > button:last-child`, `.chat-selection-bar`, `.chat-selection-bar button` |
| `src/features/chats/components/SwipeActions.tsx` | `.chat-swipe`, `.chat-swipe-content`, `.chat-swipe-actions`, `.chat-swipe-actions.swipe-right`, `.chat-swipe-actions button` |
| `src/features/chats/components/MessageRequestsSection.tsx` | `.message-requests`, `.message-requests header`, `.message-requests h2`, `.message-requests header button`, `.request-row`, `.request-open`, `.request-open > span:last-child`, `.request-open strong`, `.request-open small`, `.request-preview`, `.request-accept`, `.request-decline` |
| `src/features/chats/components/RequestDisclosure.tsx` | `.message-request-count`, `.request-toggle`, `.request-toggle:focus-visible` |
| `src/features/chats/components/NewChatFAB.tsx` | `.new-chat-fab` |
| `src/features/chats/components/NewChatDialogSurface.tsx` | `.new-chat-menu`, `.new-chat-menu [data-slot="button"]` |
| `src/features/chats/components/DeleteChatModal.tsx` | `.chat-delete-summary`, `.chat-delete-summary li`, `.chat-delete-summary p` |
| `src/features/chats/components/ChatPickerSurfaces.tsx` | `.chat-skeleton`, `.chat-skeleton > div`, `.new-chat-user-item`, `.new-chat-user-row`, `.new-group-candidate-row`, `.new-chat-user-row:hover`, `.new-group-candidate-row:hover`, `.new-group-candidate-row.is-checked`, `.new-group-candidate-checkbox`, `.new-chat-user-copy`, `.new-chat-user-identity`, `.new-chat-user-name`, `.new-chat-user-handle`, `.new-chat-user-bio`, `.new-chat-action-pill`, `.new-group-candidate-row:focus-within` |
| `src/components/ui/modal.tsx`, `src/features/chats/components/NewChatDialogSurface.tsx` | `.auth-modal.new-chat-dialog` |
| `src/routes/_authenticated.chats.new.tsx` | `.new-chat-section` |
| `src/routes/_authenticated.chats.new-group.tsx`, `src/features/settings/components/shared.tsx` | `.new-group-chip .avatar` |

## src/styles/messages.css (206 distinct selectors)

| Consumer examples | Selectors |
|---|---|
| `src/components/ui/conversation-surface.tsx`, `src/features/messages/components/ChatHeader.tsx` | `.conversation-header .conversation-search-trigger` |
| `src/routes/_authenticated.chats.$chatId.tsx` | `.conversation-page`, `.conversation-request`, `.conversation-request > div`, `.conversation-request .button`, `.conversation-error`, `.conversation-page *`, `#root:has(.conversation-page)` |
| `src/components/ui/conversation-surface.tsx` | `.conversation-header`, `.message-bubble`, `.message-date`, `.message-date span`, `.message-unread`, `.message-unread::before`, `.message-unread::after` |
| `src/features/communities/components/CommunityChatHeader.tsx` | `.conversation-identity`, `.conversation-identity > span:last-child`, `.conversation-identity strong`, `.conversation-identity small` |
| `src/features/communities/components/CommunityChatHeader.tsx`, `src/features/settings/components/shared.tsx` | `.conversation-identity .avatar` |
| `src/features/chats/components/ChatListItemSurface.tsx` | `.presence-dot` |
| `src/features/messages/components/ChatHeader.tsx` | `.conversation-actions`, `.conversation-back` |
| `src/components/ui/messaging.tsx` | `.message-icon`, `.message-icon:hover:not(:disabled)`, `.message-icon:disabled`, `.message-reply`, `.message-reply strong`, `.message-reply span`, `.conversation-composer`, `.quick-reactions`, `.quick-reactions button`, `.quick-reactions button[aria-pressed="true"]`, `.message-reply > button:first-child`, `.reply-bar`, `.live-wave` |
| `src/features/messages/components/MessageList.tsx` | `.message-list-shell`, `.message-list`, `.conversation-start`, `.message-loading`, `.message-load-error`, `.conversation-empty`, `.conversation-empty > div`, `.conversation-empty h2`, `.conversation-empty p` |
| `src/features/messages/components/MessageBubble.tsx` | `.message-row`, `.message-row.grouped`, `.message-row.own`, `.message-stack`, `.message-avatar-space`, `.message-author`, `.own .message-author`, `.message-meta`, `.message-meta time`, `.message-status`, `.message-retry`, `.message-deleted`, `.group-chat .message-stack`, `.message-overflow`, `.own .message-overflow`, `.message-row:hover .message-overflow`, `.message-row:focus-within .message-overflow`, `.forwarded-label` |
| `src/features/messages/components/MessageBubble.tsx`, `src/features/settings/components/shared.tsx` | `.message-row .avatar` |
| `src/features/messages/components/content/AudioMessage.tsx` | `.message-text`, `.message-text a` |
| `src/features/messages/utils/linkifyText.tsx` | `.message-mention` |
| `src/features/messages/components/MessageBubble.tsx`, `src/features/messages/utils/linkifyText.tsx` | `.own .message-mention` |
| `src/features/messages/components/MessageBubble.tsx`, `src/features/chats/components/ChatListItemSurface.tsx` | `.message-status.read` |
| `src/features/messages/components/content/SystemMessage.tsx` | `.message-system` |
| `src/features/messages/components/ScrollToBottomButton.tsx` | `.message-scroll-bottom`, `.message-scroll-bottom span` |
| `src/features/messages/components/content/ImageMessage.tsx` | `.message-image`, `.message-image img` |
| `src/features/messages/components/content/ImageMessage.tsx`, `src/features/messages/components/content/AudioMessage.tsx` | `.message-image + .message-text` |
| `src/features/messages/components/content/VideoMessage.tsx` | `.message-video`, `.video-play`, `.video-play svg` |
| `src/features/messages/components/content/FileMessage.tsx` | `.message-file`, `.message-file > div`, `.message-file strong`, `.message-file small` |
| `src/features/messages/components/content/ContactMessage.tsx` | `.message-contact`, `.message-contact > div`, `.message-contact small`, `.message-contact strong`, `.message-contact a` |
| `src/features/messages/components/content/StickerMessage.tsx` | `.message-sticker` |
| `src/features/messages/components/content/LocationMessage.tsx` | `.message-location` |
| `src/features/messages/components/ReactionsDisplay.tsx` | `.message-reactions`, `.message-reactions span`, `.message-reactions button`, `.message-reactions button[aria-pressed="true"]` |
| `src/features/messages/components/MessageBubble.tsx`, `src/features/messages/components/ReactionsDisplay.tsx` | `.own .message-reactions` |
| `src/features/messages/components/Composer.tsx` | `.composer-row`, `.composer-input`, `.composer-input textarea`, `.emoji-toggle`, `.composer-send`, `.composer-send:disabled`, `.composer-error`, `.emoji-popover`, `.composer-attach`, `.composer-input textarea:focus-visible`, `.composer-send:focus-visible`, `.composer-send:hover` |
| `src/features/messages/components/MentionAutocomplete.tsx` | `.mention-menu`, `.mention-menu button`, `.mention-menu [aria-selected="true"]`, `.mention-menu strong`, `.mention-menu small` |
| `src/features/messages/components/Composer.tsx`, `src/components/ui/messaging.tsx` | `.emoji-popover > .message-icon` |
| `src/features/messages/components/EmojiPanel.tsx` | `.emoji-panel`, `.emoji-panel input`, `.emoji-panel .emoji-viewport`, `.emoji-panel .emoji-list`, `.emoji-panel .emoji-category`, `.emoji-panel .emoji-choice`, `.emoji-panel .emoji-choice[data-active]`, `.emoji-row` |
| `src/features/messages/components/AttachmentMenu.tsx` | `.attachment-menu`, `.modal-close`, `.attachment-options`, `.attachment-options button`, `.attachment-options svg`, `.messaging-dialog`, `.messaging-dialog [role="alert"]`, `.attachment-options button:hover` |
| `src/features/messages/components/MediaPreviewModal.tsx` | `.media-preview`, `.media-preview-stage`, `.media-preview-stage img`, `.media-preview-stage video`, `.media-preview-stage > div`, `.media-preview label`, `.media-preview textarea`, `.media-preview progress` |
| `src/routes/settings.account.tsx` | `.modal-actions` |
| `src/features/messages/components/MediaLightbox.tsx` | `.media-lightbox`, `.media-lightbox::backdrop`, `.lightbox-backdrop`, `.lightbox-toolbar`, `.lightbox-content`, `.lightbox-content img`, `.lightbox-content video`, `.media-lightbox *`, `.lightbox-filename`, `.lightbox-caption`, `dialog.media-lightbox:has(.lightbox-caption) .lightbox-content`, `dialog.media-lightbox:has(.lightbox-caption) .lightbox-content img`, `dialog.media-lightbox:has(.lightbox-caption) .lightbox-content video` |
| `src/features/messages/components/ContactPicker.tsx` | `.contact-picker-list`, `.contact-picker-list button`, `.contact-picker-list button:hover`, `.contact-picker-list small` |
| `src/routes/_authenticated.chats.tsx` | `.conversation-unavailable` |
| `src/routes/_authenticated.tsx`, `src/routes/_authenticated.chats.$chatId.tsx` | `.authenticated-content:has(.conversation-page)`, `.authenticated-content .conversation-page` |
| `src/features/messages/components/ChatHeader.tsx`, `src/components/ui/messaging.tsx` | `.conversation-actions .message-icon` |
| `src/routes/_authenticated.chats.$chatId.tsx`, `src/features/settings/components/PendingDeletionBanner.tsx` | `#root:has(.conversation-page) > .deletion-banner` |
| `src/features/messages/components/MessageContextMenu.tsx` | `.message-context-menu`, `.message-context-menu button`, `.message-context-menu button:hover`, `.message-context-menu button:focus-visible`, `.message-context-menu-separator` |
| `src/features/messages/components/MessageContextMenu.tsx`, `src/components/ui/chat-menu-surface.tsx` | `.message-context-menu .danger` |
| `src/features/messages/components/ForwardModal.tsx` | `.forward-chats`, `.forward-chats label`, `.forward-chats input`, `.forward-chats label:has(:checked)`, `.forward-chats label:focus-within` |
| `src/features/messages/components/InChatSearch.tsx` | `.in-chat-search`, `.in-chat-search > div`, `.in-chat-search input`, `.in-chat-search small`, `.in-chat-search [role="status"]` |
| `src/features/messages/components/PinnedMessagesBar.tsx` | `.pinned-messages`, `.pinned-messages button`, `.pinned-toggle > svg`, `.pinned-toggle`, `.pinned-toggle span`, `.pinned-messages > div`, `.pinned-messages > div > span` |
| `src/features/messages/components/SearchHighlight.tsx` | `.message-highlight` |
| `src/features/messages/components/MessageActionsProvider.tsx` | `.message-action-notice`, `.message-action-notice button` |
| `src/features/messages/components/VoiceRecorder.tsx` | `.voice-recorder`, `.voice-recorder > small`, `.recording-dot` |
| `src/features/messages/components/VoicePlayer.tsx` | `.voice-player`, `.voice-player small`, `.voice-player audio`, `.voice-track`, `.voice-track svg`, `.voice-track input`, `.voice-track:focus-within`, `.voice-toggle:focus-visible`, `.voice-player > [role="alert"]`, `.voice-player .voice-toggle`, `.voice-track rect` |
| `src/features/messages/components/InChatSearch.tsx`, `src/components/ui/messaging.tsx` | `.in-chat-search .message-icon` |
| `src/features/chat-settings/components/SharedMediaTab.tsx` | `.media-outage-placeholder` |
| `src/features/messages/components/AttachmentMenu.tsx`, `src/routes/settings.account.tsx` | `.messaging-dialog .modal-actions` |
| `src/features/messages/components/AttachmentMenu.tsx`, `src/features/chat-settings/components/GroupSettingsScreen.tsx` | `.messaging-dialog .field` |
| `src/features/messages/components/VoicePlayer.tsx`, `src/components/ui/messaging.tsx` | `.voice-track rect.played` |
| `src/features/messages/components/MediaLightbox.tsx`, `src/components/ui/messaging.tsx` | `.lightbox-toolbar .message-icon` |
| `src/features/messages/components/VoiceRecorder.tsx`, `src/features/messages/components/VoicePlayer.tsx` | `.voice-recorder > .voice-player` |

## src/styles/chat-settings.css (123 distinct selectors)

| Consumer examples | Selectors |
|---|---|
| `src/components/ui/chat-settings-surfaces.tsx` | `.chat-settings-screen`, `.chat-settings-screen > header`, `.chat-settings-screen h1`, `.chat-settings-screen h2`, `.chat-settings-screen a`, `.chat-settings-screen input`, `.chat-settings-screen textarea`, `.group-member`, `.shared-media-tile`, `.shared-media-tile img`, `.shared-media-tile svg`, `.shared-file-row`, `.shared-file-row strong`, `.shared-file-row small`, `.shared-media-tile-v2 > span`, `.shared-file-row-v2 strong`, `.shared-file-row-v2 small`, `.chat-settings-panel`, `.chat-settings-panel > header`, `.chat-settings-panel > header > a`, `.chat-settings-panel h1`, `.chat-settings-panel h2`, `.chat-settings-panel :is(input, textarea)`, `.chat-settings-dialog textarea`, `.chat-settings-panel :is(button, a, input, textarea):focus-visible`, `.chat-settings-dialog :is(button, textarea, input):focus-visible`, `.group-member-v2`, `.chat-settings-dialog fieldset`, `.chat-settings-dialog :is(input[type="radio"], input[type="checkbox"])`, `.shared-media-tile-v2`, `.shared-media-tile-v2:hover`, `.shared-media-tile-v2:active`, `.shared-file-row-v2` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/features/chat-settings/components/GroupSettingsScreen.tsx` | `.chat-settings-screen .field`, `.chat-settings-panel .chat-info-card`, `.chat-settings-panel .chat-info-card > p`, `.chat-settings-panel .field`, `.chat-settings-panel .group-avatar-placeholder`, `.chat-settings-panel .group-links`, `.chat-settings-panel .group-links a`, `.chat-settings-panel .group-links a + a`, `.chat-settings-panel .group-links a:hover`, `.chat-settings-dialog .field` |
| `src/features/communities/components/CommunitySettingsActions.tsx` | `.chat-settings-modal textarea`, `.chat-settings-modal`, `.chat-settings-modal fieldset` |
| `src/features/messages/components/AttachmentMenu.tsx` | `.modal-close` |
| `src/features/chat-settings/components/ContactProfileModal.tsx` | `.contact-actions`, `.contact-profile-dialog .contact-close`, `.contact-profile-dialog .contact-actions` |
| `src/features/communities/components/CommunityChatHeader.tsx` | `button.conversation-identity` |
| `src/components/ui/chat-menu-surface.tsx` | `.chat-options-menu`, `.chat-options-menu button`, `.chat-options-menu button:hover`, `.chat-options-menu button:focus-visible`, `.chat-options-menu .danger`, `.chat-options-menu hr`, `.chat-options-menu-v2 button`, `.chat-options-menu-v2`, `.chat-options-menu-v2[data-closing]`, `.chat-options-menu-v2 button > span`, `.chat-options-menu-v2 button > svg`, `.chat-options-menu-v2 button.danger`, `.chat-options-menu-v2 button.danger svg`, `.chat-options-menu-v2 button:hover`, `.chat-options-menu-v2 button:focus-visible`, `.chat-options-menu-v2 button:active` |
| `src/features/chat-settings/components/MuteSubmenu.tsx` | `.mute-options` |
| `src/features/chat-settings/components/ReportModal.tsx` | `.report-reason` |
| `src/components/ui/channel-surfaces.tsx` | `.group-photo` |
| `src/features/chat-settings/components/GroupSettingsScreen.tsx` | `.group-avatar-placeholder`, `.group-description`, `.group-links` |
| `src/features/chat-settings/components/GroupSettingsScreen.tsx`, `src/features/messages/components/ChatHeader.tsx` | `.group-avatar-placeholder.small` |
| `src/features/chat-settings/components/GroupMembersList.tsx` | `.member-identity`, `.member-identity span`, `.member-identity strong`, `.member-identity small`, `.member-actions`, `.member-actions button`, `.chat-member-section` |
| `src/features/chat-settings/components/AddMembersModal.tsx` | `.member-choice small`, `.member-candidates`, `.member-choice`, `.member-choice input`, `.selected-members`, `.selected-members button` |
| `src/features/chat-settings/components/SharedMediaView.tsx` | `.shared-tabs`, `.shared-tabs button`, `.shared-tabs button[aria-selected="true"]`, `.shared-content-panel` |
| `src/features/chat-settings/components/SharedMediaTab.tsx` | `.shared-media-grid` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/components/ui/file-icon-tile.tsx` | `.shared-file-row > span:not(.file-icon-tile)` |
| `src/features/chat-settings/components/ChatSettingsNotice.tsx` | `.chat-settings-notice`, `.chat-settings-notice button`, `.chat-settings-notice-v2` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/features/chat-settings/components/GroupMembersList.tsx` | `.group-member-v2 .member-identity`, `.group-member-v2 .member-identity > span:last-child`, `.group-member-v2 .member-identity strong`, `.group-member-v2 .member-identity small`, `.group-member-v2 .member-actions`, `.group-member-v2 .member-actions button`, `.chat-settings-panel.community-members-panel` |
| `src/components/ui/modal.tsx`, `src/components/ui/settings-surfaces.tsx`, `src/components/ui/chat-settings-surfaces.tsx` | `.auth-modal.settings-dialog.chat-settings-dialog` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/features/chat-settings/components/ReportModal.tsx` | `.chat-settings-dialog .report-reason`, `.chat-settings-dialog .report-reason:has(input:checked)` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/features/chat-settings/components/MuteSubmenu.tsx` | `.chat-settings-dialog .mute-options`, `.chat-settings-dialog .mute-options button` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/features/chat-settings/components/AddMembersModal.tsx` | `.chat-settings-dialog .member-candidates`, `.chat-settings-dialog .member-candidates h3`, `.chat-settings-dialog .member-choice`, `.chat-settings-dialog .member-choice:has(input:checked)`, `.chat-settings-dialog .member-choice > span:last-child`, `.chat-settings-dialog .member-choice small`, `.chat-settings-dialog .selected-members`, `.chat-settings-dialog .selected-members button` |
| `src/features/chat-settings/components/ContactProfileModal.tsx`, `src/components/ui/public-profile-surface.tsx` | `.contact-profile-dialog .public-profile-card`, `.contact-profile-dialog .public-profile-content`, `.contact-profile-dialog .public-profile-identity h2` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/features/chat-settings/components/SharedMediaView.tsx` | `.chat-settings-panel .shared-tabs`, `.chat-settings-panel .shared-tabs button`, `.chat-settings-panel .shared-tabs button[aria-selected="true"]` |
| `src/components/ui/chat-settings-surfaces.tsx`, `src/features/chat-settings/components/ReportModal.tsx`, `src/features/chat-settings/components/AddMembersModal.tsx` | `.chat-settings-dialog :is(textarea, .report-reason, .member-choice)` |

## src/styles/communities.css (56 distinct selectors)

| Consumer examples | Selectors |
|---|---|
| `src/features/communities/components/CommunitiesList.tsx` | `.communities-page`, `.communities-title`, `.community-search`, `.community-cards` |
| `src/components/ui/community-surfaces.tsx` | `.community-card`, `.community-card-heading`, `.community-card-heading:focus-visible`, `.community-avatar-frame`, `.community-avatar-frame [data-slot="avatar"]`, `.community-card-title`, `.community-card-title strong`, `.community-card-title > span`, `.community-card-title small`, `.community-card-chats`, `.community-card-chats[data-state="open"]`, `.community-card-chats-clip`, `.community-card-chats-content`, `.community-chat-icon`, `.community-chat-copy`, `.community-chat-copy strong`, `.community-chat-copy > span`, `.community-chat-meta` |
| `src/components/ui/community-surfaces.tsx`, `src/features/settings/components/shared.tsx` | `.community-avatar-frame .avatar` |
| `src/features/communities/components/CommunityChatListItem.tsx` | `.community-chat-row`, `.community-chat-row:hover`, `.community-chat-row:focus-visible`, `.community-chat-row[aria-current="page"]`, `.community-unread-dot` |
| `src/features/communities/components/CommunityChatListItem.tsx`, `src/components/ui/community-surfaces.tsx` | `.community-chat-row[aria-current="page"] .community-chat-icon` |
| `src/features/communities/components/CommunityCard.tsx` | `.community-view-all` |
| `src/features/communities/components/CommunityChatSidebar.tsx` | `.community-sidebar`, `.community-sidebar-header`, `.community-sidebar-footer`, `.community-new-chat` |
| `src/routes/_authenticated.communities.$communityId.index.tsx` | `.community-empty-pane`, `.community-empty-icon` |
| `src/features/communities/components/CommunityInfoScreen.tsx` | `.community-info` |
| `src/features/communities/components/CommunityInfoScreen.tsx`, `src/components/ui/chat-settings-surfaces.tsx` | `.community-info .chat-settings-screen`, `.community-info .chat-settings-screen > header` |
| `src/features/communities/components/CommunityInfoScreen.tsx`, `src/components/ui/channel-surfaces.tsx` | `.community-info .group-photo` |
| `src/features/communities/components/CommunityInfoScreen.tsx`, `src/features/chat-settings/components/GroupSettingsScreen.tsx` | `.community-info .group-avatar-placeholder`, `.community-info .field`, `.community-info .field input`, `.community-info .field textarea` |
| `src/features/communities/components/CommunitySettingsActions.tsx` | `.community-actions` |
| `src/features/communities/components/CreationDialog.tsx` | `.community-creation-dialog` |
| `src/features/communities/components/CreateCommunityChatModal.tsx` | `.community-creation-form`, `.community-creation-form input`, `.community-creation-form textarea`, `.community-creation-form [role="alert"]` |
| `src/features/communities/components/CreateCommunityChatModal.tsx`, `src/features/chat-settings/components/GroupSettingsScreen.tsx` | `.community-creation-form .field` |
| `src/features/communities/components/CreateCommunityChatModal.tsx`, `src/routes/settings.account.tsx` | `.community-creation-form .modal-actions` |
| `src/routes/_authenticated.communities.$communityId.tsx` | `.community-layout` |
| `src/routes/_authenticated.communities.$communityId.tsx`, `src/routes/_authenticated.chats.$chatId.tsx` | `.community-layout .conversation-page` |
| `src/routes/_authenticated.communities.$communityId.tsx`, `src/components/ui/chat-settings-surfaces.tsx` | `.community-layout .chat-settings-screen` |
| `src/routes/_authenticated.tsx`, `src/routes/_authenticated.communities.$communityId.tsx` | `.authenticated-content:has(.community-layout)` |

## src/styles/novedades.css (156 distinct selectors)

| Consumer examples | Selectors |
|---|---|
| `src/routes/_authenticated.novedades.tsx` | `.novedades-page`, `.novedades-page .novedades-header`, `.novedades-page h1`, `.novedades-page h2`, `.novedades-page a`, `:where(.novedades-header) input`, `.novedades-bottom`, `.novedades-bottom > *`, `.novedades-search`, `.novedades-search > svg`, `.novedades-search input` |
| `src/routes/_authenticated.novedades.tsx`, `src/features/chat-settings/components/GroupSettingsScreen.tsx` | `:where(.novedades-page .field) input`, `:where(.novedades-page .field) textarea`, `.novedades-page .field` |
| `src/features/novedades/components/channels/ChannelInfoScreen.tsx` | `.channel-create-modal :where(input:not([type="file"]))`, `.channel-create-modal textarea`, `.channel-form input:focus-visible`, `.channel-form textarea:focus-visible`, `.channel-form textarea` |
| `src/features/novedades/components/channels/ChannelInfoScreen.tsx`, `src/features/chat-settings/components/GroupSettingsScreen.tsx` | `.channel-create-modal .field`, `.channel-form .field` |
| `src/features/novedades/components/channels/ChannelsSection.tsx` | `.novedades-empty`, `.channels-section > h2` |
| `src/features/novedades/components/stories/StoriesRow.tsx` | `.stories-row`, `.stories-row::-webkit-scrollbar`, `.stories-section` |
| `src/components/ui/story-surfaces.tsx` | `.story-card-wrap`, `.story-card`, `.story-card:after`, `.story-card.unwatched`, `.story-card.empty`, `.story-card.empty:after`, `.story-card strong`, `.story-card-text`, `.story-add`, `.story-progress`, `.story-progress > div`, `.story-progress span`, `.story-stage`, `.story-stage img`, `.story-stage video`, `.story-reply`, `.story-reply input`, `.story-reply button`, `.story-reply p`, `.story-card-wrap .story-card`, `.story-card-wrap .story-card.unwatched`, `.story-card-wrap .story-card.empty`, `.story-card-wrap .story-card:hover`, `.story-card-wrap .story-card:active`, `.story-card-wrap .story-card:focus-visible`, `.story-avatar-ring`, `.unwatched .story-avatar-ring`, `.story-camera`, `.story-reply .story-send` |
| `src/components/ui/story-surfaces.tsx`, `src/features/settings/components/shared.tsx` | `.story-card .avatar`, `.story-card.unwatched .avatar`, `.story-card .story-avatar-ring .avatar` |
| `src/features/novedades/components/stories/StoryCard.tsx` | `.story-card-preview`, `.story-card-placeholder` |
| `src/features/novedades/components/channels/ChannelListItem.tsx` | `.channel-list-item`, `.channel-list-item:hover`, `.channel-list-item:focus-visible`, `.channel-row-reveal` |
| `src/features/novedades/components/channels/DiscoverChannelsSection.tsx` | `.discover-channel`, `.channel-discovery-link`, `.channel-discovery-link strong`, `.channel-discovery-link > span`, `.channel-discovery-link p`, `.channel-discovery-link small`, `.discover-channel:hover`, `.channel-discovery-link:focus-visible` |
| `src/components/ui/channel-surfaces.tsx` | `.channel-row-copy`, `.channel-row-copy strong`, `.channel-row-copy small`, `.channel-row-meta`, `.channel-description`, `.channel-row-copy strong svg`, `.channel-row-description`, `.channel-follow-button`, `.channel-follow-label`, `.channel-profile`, `.channel-profile-identity`, `.channel-profile-identity .group-photo`, `.channel-profile-identity h1`, `.channel-profile-identity h1 svg`, `.channel-profile-identity > p:not(.channel-description)`, `.channel-profile-identity > small`, `.channel-profile-actions`, `.channel-profile-actions > .channel-follow-button` |
| `src/features/novedades/components/channels/ChannelHeader.tsx` | `.channel-header-identity strong`, `.channel-header small`, `.channel-header-identity`, `.channel-header-identity > span`, `.channel-header a`, `.channel-header` |
| `src/components/ui/channel-surfaces.tsx`, `src/features/chats/components/ChatListItemSurface.tsx` | `.channel-row-meta .chat-badge` |
| `src/features/novedades/components/channels/ChannelInfoScreen.tsx`, `src/components/ui/conversation-surface.tsx` | `.channel-info .conversation-header` |
| `src/features/novedades/components/channels/ChannelInfoScreen.tsx`, `src/routes/_authenticated.chats.$chatId.tsx` | `.channel-info > .button` |
| `src/components/ui/modal.tsx`, `src/features/novedades/components/stories/StoryViewer.tsx` | `.auth-modal.story-viewer` |
| `src/features/novedades/components/stories/StoryViewer.tsx` | `.story-viewer > h2`, `.story-viewer-header`, `.story-viewer-header > span:not(.story-pause-indicator)`, `.story-viewer-header small`, `.story-viewer-header button`, `.story-controls button`, `.story-owner-views`, `.story-text`, `.story-caption`, `.story-controls`, `.story-play`, `.story-pause-indicator`, `.story-pause-indicator[data-paused="true"]`, `.story-delete-action` |
| `src/features/novedades/components/stories/StoryViewersSheet.tsx` | `.story-viewers-sheet`, `.story-viewer-person`, `.story-viewer-person small` |
| `src/components/ui/modal.tsx`, `src/features/novedades/components/stories/StoryCreator.tsx` | `.auth-modal.story-creator` |
| `src/features/novedades/components/stories/StoryCreator.tsx` | `.story-create-preview`, `.story-create-preview img`, `.story-create-preview video`, `.story-creator textarea`, `.story-creator input[type="file"]`, `.story-create-modes`, `.story-create-modes button`, `.story-create-modes button[aria-pressed="true"]`, `.story-create-empty`, `.story-create-empty svg` |
| `src/features/novedades/components/stories/StoryTextEditor.tsx` | `.story-text-editor`, `.story-text-editor textarea`, `.story-text-editor textarea::placeholder`, `.story-colors`, `.story-colors button`, `.story-colors input`, `.story-colors button[aria-pressed="true"]` |
| `src/features/messages/components/MessageBubble.tsx` | `.story-reply-reference` |
| `src/routes/_authenticated.novedades.tsx`, `src/routes/_authenticated.chats.$chatId.tsx` | `.novedades-bottom .button` |
| `src/components/ui/modal.tsx`, `src/features/novedades/components/channels/ChannelInfoScreen.tsx` | `.auth-modal.channel-create-modal`, `.auth-modal.channel-overlay` |
| `src/features/novedades/components/channels/DiscoverChannelsSection.tsx`, `src/routes/_authenticated.chats.$chatId.tsx` | `.discover-channel > .button` |
| `src/routes/_authenticated.novedades.tsx`, `src/features/novedades/components/stories/StoriesRow.tsx` | `.novedades-page .stories-heading` |
| `src/components/ui/motion-overlay.tsx` | `.story-overlay-body`, `.story-overlay.story-exiting .story-overlay-body`, `.story-overlay::backdrop`, `.story-overlay button`, `.story-overlay button:active:not(:disabled)`, `.story-overlay button:focus-visible`, `.story-overlay .story-overlay-body` |
| `src/features/novedades/components/stories/StoryViewer.tsx`, `src/components/ui/motion-overlay.tsx` | `.story-viewer .story-overlay-body` |
| `src/components/ui/modal.tsx`, `src/components/ui/motion-overlay.tsx` | `.auth-modal.story-overlay`, `.auth-modal.story-overlay.story-exiting` |
| `src/components/ui/motion-overlay.tsx`, `src/features/novedades/components/stories/StoryCreator.tsx` | `.story-overlay .story-file-picker` |
| `src/components/ui/modal.tsx`, `src/features/novedades/components/stories/StoryViewersSheet.tsx` | `.auth-modal.story-viewers-sheet` |
| `src/components/ui/motion-overlay.tsx`, `src/features/novedades/components/stories/StoryViewersSheet.tsx` | `.story-overlay.story-viewers-sheet .story-overlay-body` |
| `src/features/novedades/components/stories/StoryViewersSheet.tsx`, `src/components/ui/motion-overlay.tsx` | `.story-viewers-sheet.story-exiting .story-overlay-body` |
| `src/features/novedades/components/channels/ChannelView.tsx` | `.channel-read-retry` |
