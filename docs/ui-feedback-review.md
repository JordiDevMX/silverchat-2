# Verified UI review procedure

**Current state (2026-11-06): the UI migration is closed through Module 5C / TASK-006.** The reference directory has been removed. Earlier module-specific notes below retain their original acceptance context; statements that another module was deferred are historical, not current scope. See the [closeout report](ui-migration-closeout.md) for cleanup counts, every gate/suite result, preserved user state and exact automation commands. The two Docker-dependent database suites were unavailable on this host; all screenshot-free browser suites passed.

## Final manual acceptance checklist

Start from a clean review-server terminal with `pnpm review:ui`, then open **http://127.0.0.1:5177/tests/ui-foundation.html** (or **http://127.0.0.1:5177/**). No login/backend is needed. Review all ten sections at **375 × 844**, **768 × 1024**, **1280 × 900**, with **Light/Dark × blue, purple, red, orange, yellow, green**: 36 combinations per section. Use live devtools inspection only; no screenshots.

| Section / URL fragment | Expected states to inspect |
|---|---|
| Foundation (page top) | Neon fills unchanged between modes; white S; mode-dependent control glyphs; working focus, switch, modal and OTP samples |
| `#conversation-gallery` | Own/other bubbles, nine message types, wrapping, dates/unread/pin/search/header states |
| `#interactive-gallery` | Composer, reply/edit previews, emoji, actions, search/forward/pins and audio control states |
| `#communities-gallery` | Cards, sidebar/info/settings/creation; expand/collapse feels fluid; counts and focus retained |
| `#stories-gallery` | Story cards, creator/viewer/replies; containment and functional controls |
| `#channels-gallery` | Discovery/follow/create/info; channel header, menus and shared conversation |
| `#settings-gallery` | Shell/sidebar and preferences; theme/accent controls, rows and cards |
| `#settings-details-gallery` | Profile/social/public card, crop, privacy/security/device/deletion/recovery states |
| `#chat-settings-gallery` | Info/member/contact/media/file states, menus, confirmations and keyboard tabs |
| `#auth-gallery` | Landing/login/signup/MFA/onboarding and infrastructure cards; mandatory dialog and form wrapping |

At every width, check clipping/overflow and long text, Tab/Enter/Space/Escape, focus return and overlay containment. Emulate reduced motion: decorative transitions become instant while story/auth timing remains functional. Existing gallery fixtures use local demonstration state; they do not simulate authenticated service outcomes.

For live acceptance use the **normal backend-enabled app**, typically **http://127.0.0.1:5173/** after normal sign-in (and its configured BFF/backend), not the standalone 5177 server. Visit `/chats`, `/chats/<chatId>`, `/communities`, `/communities/<communityId>/chats/<chatId>`, `/novedades`, `/settings`, and the chat-info/settings routes linked from a conversation; repeat the same viewport/theme/accent matrix. Inspect list filters/creation/requests, send/retry/drafts/search/media, shared community/channel conversations, settings persistence and signed downloads. In a separate signed-out session inspect `/`, `/auth/login`, `/auth/signup` and the normal MFA/onboarding flow. Service-dependent mail/CAPTCHA and account actions remain live manual checks. The detailed module checklists below specify the existing route shapes and expected behaviors.

## Start here — no account or backend needed

1. Open a terminal in the SilverChat repository. Stop any previous review server in its own terminal with Ctrl+C.
2. Run exactly:

```text
pnpm review:ui
```

3. Wait for Vite to print `http://127.0.0.1:5177/` and its UI review link. Keep that terminal open.
4. Open **http://127.0.0.1:5177/** in your browser. It redirects to **http://127.0.0.1:5177/tests/ui-foundation.html**.

You should see the SilverChat brand, Light/Dark buttons, an Accent selector, the neon action examples, two message-bubble samples, a Chats header with metallic search, a closed Message requests section, four tab-action tiles, and the **Conversation timeline**, **Interactive messaging**, **Communities**, **Stories**, **Broadcast channels** and **Settings shell & preferences** galleries. This uses the real migrated components. It does not mount the app/auth providers, load .env files, require Supabase credentials, or contact the auth backend. The latest sections are **Chat settings & info** and **Auth, onboarding & infrastructure**.

**Do not double-click the HTML file or open a file:// URL.** Browsers cannot run this TypeScript/ESM fixture directly from disk. The HTML now displays the command and working HTTP link if its module cannot load.

If startup says `Port 5177 is already in use`, the new server did not start. Stop your previous instance in its terminal, then run the command again. Use the printed URL on **5177**; review no longer uses 5187. Both commands use strict ports.

## Exact URLs and expected content

| URL | Expected result |
|---|---|
| http://127.0.0.1:5177/ | 302 redirect to the fixture, then 200 and the migrated review components |
| http://127.0.0.1:5177/tests/ui-foundation.html | 200; fixture directly, no login |
| http://127.0.0.1:5177/ui-foundation.html | Short-name compatibility alias: 302 to the same fixture |
| http://127.0.0.1:5177/ui-review | 302 to the same fixture |
| http://127.0.0.1:5177/chats | Review-server explanation with a link back to the fixture; not a live chat session |
| http://127.0.0.1:5177/communities | Same backend-requirement explanation |
| http://127.0.0.1:5177/settings/appearance | Same explanation; use the fixture's theme/accent controls instead |

## Viewports, themes and fixture states

- Inspect **375 × 844**, **768 × 1024**, and **1280 × 900** or wider using devtools device emulation.
- Use the fixture's **Light/Dark** buttons and **Accent** selector. Check blue, orange, green and purple; also red and yellow for text/glyph contrast.
- Emulate reduced motion, and use Tab/Enter/Space. Glows remain static and keyboard focus remains distinguishable.

1. **Bubble surfaces** and the **bubble-self** tile: light mode has pale accent fill and a softer visible halo; dark mode has gradient fill, bright rim and diffuse glow. The other bubble remains unlit. Change accents and confirm the fill and halo follow them.
2. **Chats header preview**: inspect the white S glyph on its neon-gradient tile, foreground “ilver,” accent “Chat,” and separate small Chats heading. No Select/Refresh/PWA control should appear.
3. Search: inspect the metallic surface at rest and while typing; no gray outline box. Tab into the field to see its intentional focus indicator; clear entered text.
4. **Message requests** starts closed with a count. Open and close it by click, Enter and Space. Content should appear only when expanded.
5. **Tab actions**: compare chat-plus, phone-plus, group and broadcast glyphs. Confirm neon-gradient squircle tiles, **white glyphs in light mode / near-black glyphs in dark mode**, and static halo without a surrounding ring. Keyboard focus brightens the tile and thickens the glyph. Calls/Updates here are presentation previews, not live creation features.

## Primary fills and mobile search polish

Run `pnpm review:ui` and open **http://127.0.0.1:5177/tests/ui-foundation.html**. No login or backend is needed for this fixture. The current fix was verified from a clean server and fresh browser contexts on 5177.

- At **375 × 844**, **768 × 1024**, and **1280 × 900**, select Light/Dark and each of blue, orange, green, purple, red, yellow. Compare the logo, **Light, built in** switch/badge/active Chats navigation sample, and all four **Tab actions** tiles. Every fill has two accent-aware gradient stops. Glyphs and checked-switch thumbs are white in light and near-black in dark; the logo S stays white in both.
- **The fill must not change when switching Light/Dark.** Each accent uses the exact approved dark-mode stop pair on Follow/Light buttons, logo, all FABs, checked switch, neon badges and active nav icons. Only glyph/foreground colors switch. The deeper light-only variants have been removed; the logo S remains white in both modes.
- The canonical **--gradient-neon** now reads mode-invariant **--primary-fill-from / --primary-fill-to** stops. Separate fill stops avoid changing the existing mode-aware outline, text-accent and glow palette. **--neon-end** retains its approved theme-neutral name. Legacy icon/label utility names now resolve to the same canonical gradient, with no contrast caps.
- Automated checks compare exact gradient stops across all consumers and modes at all three viewports, including the pre-fix approved dark palette. Resting-state contrast is sampled at 21 gradient positions. The lower light-mode contrast below is an intentional consequence of the requested bright fill plus white glyphs; the previous contrast thresholds no longer apply. No fill hue, brightness or glyph color was changed to raise these ratios.

| Accent | Minimum light-mode white glyph/text contrast | Dark-mode near-black control contrast |
|---|---:|---:|
| Blue | 1.74:1 | 7.24:1 |
| Orange | 2.03:1 | 8.17:1 |
| Green | 1.73:1 | 10.94:1 |
| Purple | 2.19:1 | 6.91:1 |
| Red | 2.37:1 | 6.01:1 |
| Yellow | 1.37:1 | 14.13:1 |

- In **Conversation timeline**, inspect the header at **375px and 767px**: magnifier hidden, three-dot control visible. At **768px and 1280px**, both are visible. Fixture header controls remain static/disabled.
- To verify actual mobile search after normal backend login, open `/chats/<chatId>` on your app origin at **375 × 844**, choose **Chat options → Search in chat**, enter existing message text, navigate a result, then press Escape or close search. The existing search UI opens and closes; the header magnifier stays hidden. Repeat at **1280 × 900** using the visible header magnifier. This behavior is also covered by the mocked authenticated browser harness; the standalone fixture does not simulate a session.

Module 2B remains deferred. No search redesign, new dependency, auth change or image capture is included.


## Module 2A: conversation timeline acceptance

Open **http://127.0.0.1:5177/tests/ui-foundation.html#conversation-gallery** after starting the review command.

Use **375 × 844**, **768 × 1024**, and **1280 × 900**. At each width select both **Light** and **Dark**, and all six accents: **blue, purple, red, orange, yellow, green**. The gallery is a complete document section so every sample is easy to inspect; the authenticated app keeps a fixed header/composer with only the message history scrolling.

1. Header: Sofia Reyes, Online accent dot, silver header, back/search/call/video/options controls and one pinned message. Preview header controls are disabled; pin content is static.
2. Text: incoming neutral silver surface; own pale accent in light and luminous gradient in dark, smaller corner on the sender's side, compact timestamp/read glyph. Check the underlined example.com link, wrapping and selected/unselected reactions.
3. Timeline: Today pill, Unread messages divider, comfortable spacing, subtle radial backdrop and accent navigation highlight near the bottom.
4. Attachments: incoming and own brand-sketch images (existing local favicon), video preview, document tile, contact, location and borderless waving sticker. Rounded media must stay inside the bubbles at 375px.
5. Audio: incoming and own **static 0:18 waveforms** inside new bubbles. These previews have no playback controls or audio requests. Real VoicePlayer remains unchanged for Module 2B.
6. End states: neutral system event, both own/other deleted tombstones, highlighted message, and latest-message arrow with a glowing count of 3. The preview arrow scrolls to the highlighted sample.

No account, .env, network service or data provider is needed. The favicon is a local existing asset. Final visual acceptance is manual; automated DOM/computed-style checks covered all 36 viewport/theme/accent combinations without image captures.

For live behavior after normal backend login, use your app origin and these exact route shapes (substitute IDs belonging to your account):

- `/chats/<chatId>`: direct/group/self thread with history; scroll up for pagination, receive a message while away from bottom, then use the latest arrow. Open the header identity/options and search triggers.
- `/chats/<chatId>?scrollTo=<messageId>`: retained deep-link positioning; pinned Go to message and quoted-reply navigation should highlight the target.
- `/chats/<pendingRequestChatId>`: accept/decline request and verify composer availability/navigation.
- `/communities/<communityId>/chats/<chatId>`: injected community header and shared timeline, with the same messages, read state and settings behavior.

Check reply selection focuses the composer, drafts restore after leaving/reopening, and pending/failed sends keep newer text/replies and upload retries. Audio should remain one-at-a-time and stop/reset on replacement or unmount. These are authenticated behavior checks; standalone review intentionally does not simulate them.

## Alternative: plain application development server

```text
pnpm dev
```

This starts strictly at **http://127.0.0.1:5173/** and prints the explicit no-login fixture link **http://127.0.0.1:5173/tests/ui-foundation.html**. The short aliases above also work on 5173. Stop an old server before restarting; a port conflict now exits rather than silently switching to 5174.

**The 5173 root is not the UI review page.** It still serves the existing application entry. Plain Vite does not run the Netlify auth functions: without that backend, POST /api/auth/refresh returns 404 and the app shows its existing “Let's reconnect” auth frame, including when opening /chats or /communities. This is not evidence that the migration disappeared. With a working backend, logged-out requests to those protected routes go to /auth/login; authenticated sessions show the migrated surfaces.

## File-type tiles — manual review

1. Start a fresh `pnpm review:ui` server, then open **http://127.0.0.1:5177/tests/ui-foundation.html#conversation-gallery** in a fresh browser tab. No account/backend is needed. The **Conversation timeline** contains fourteen file rows: seven examples, each incoming and outgoing.
2. In devtools, inspect **375 × 844**, **768 × 1024**, and **1280 × 900**. At each size, select **Light** and **Dark**, each with **blue, orange, green, purple, red and yellow** accents (36 combinations).
3. Expect circular 48px tiles with a colored document glyph, matching tinted fill and thin ring. PDF is red; spreadsheet green; Word blue; presentation orange; text/notes purple. Unknown files use a white glyph on a deep neutral in Light and a near-black glyph on a pale neutral in Dark. Family colors remain independent of the accent and of incoming/outgoing bubble paint.
4. Check **Q3_Financial_Report.pdf**, **Project budget.xlsx**, **Project brief.docx**, **Team update.pptx**, **Meeting notes.txt**, and **Backup.custom**. Each shows size plus a readable type label and an arrow-into-tray download icon. The fixture's download buttons are intentionally disabled; no fake transfer occurs.
5. **Renamed spreadsheet.pdf** must have a **green spreadsheet tile** and **Spreadsheet** label in both directions: its stored MIME takes precedence over its name. Specific unsupported MIME types stay neutral; only missing/generic binary MIME falls back to the extension. Metadata is not file-content verification and is not presented as a safety guarantee.
6. Check that the ring stays visible on outgoing neon bubbles, the full type label wraps without clipping, filenames do not displace the download affordance, and the approved primary gradients remain unchanged.

With the normal authenticated backend running (separate from the standalone fixture), inspect **/chats/<chatId>** with file messages, the same chat's **/chats/<chatId>/media?tab=files** shared-files view, and **Attach → select a document → Send attachment** preview. These reuse the same resolver/tile. Verify English/Spanish labels through settings; shared files still show the original date, and preview captions/send/cancel and download behavior remain intact. The automated app suites use mocked data on 5173; they do not create a live account.

## Module 2B — interactive messaging review

Run **pnpm review:ui** and open **http://127.0.0.1:5177/tests/ui-foundation.html#interactive-gallery**. The new **Interactive messaging** section sits below Conversation timeline. Use a fresh browser tab; no login or backend is required. Review **375 × 844**, **768 × 1024**, **1280 × 900**, each in **Light/Dark** with **blue, orange, green, purple, red, yellow** accents.

- **Composer & reply:** silver dock, rounded input, outlined attachment control and glowing send. The send fill must match Follow/Light for each accent; white glyph in Light, near-black in Dark. Type in Preview message, insert an emoji, cancel the reply, and use Reply in the sample menu to restore it. Preview attachments toggles four labeled tools. Preview send clears only the fixture draft and updates a local notice.
- **Emoji & mentions:** inspect the themed search/list surfaces and highlighted mention row; click an emoji/member to append it to the local draft. These are static sample lists; actual searchable emoji and keyboard mentions are checked in the authenticated flow below.
- **Voice:** Preview play/pause toggles its icon; drag or keyboard-seek the range to change waveform progress/time. Preview start recording/stop recording switches idle/live-wave samples. No audio, timer or microphone runs here. With reduced motion enabled, the recording dot must remain steady.
- **Actions & reactions:** select/remove a reaction and check the accent ring/glow. The local menu shows icon alignment and destructive color. Edit opens a real focus-trapped modal; type, save/cancel, or press Escape. Other sample actions update local preview state/notice; they do not mutate server data.
- **Search & media:** preview search switches between results/no-results; arrows cycle two local results. The inline dark lightbox shows a glass filename/download/close toolbar and caption over the existing local mark. Download/close are intentionally disabled in this inline frame. Inspect wrapping, touch targets and absence of horizontal clipping at each size.
- Recheck **#conversation-gallery** for the approved timeline, all incoming/outgoing file families and unchanged primary gradients.

For real behavior, use the normal authenticated backend on **your app origin**, then open **/chats/<chatId>** (direct and group conversations). The isolated 5177 review server does not host these sessions. The browser harness uses mocked boundaries on **http://127.0.0.1:5173**; bare pnpm dev is not a replacement for the auth backend.

1. Type a draft, navigate away/back, reply to a message, insert emoji at the caret, and choose a group @mention with arrows/Enter/Escape. Verify Shift+Enter, reply cancellation, send/retry and later text/reply surviving a delayed send.
2. Use Attach → Photo/Video, Camera, File and Contact. Inspect the document family tile, caption, upload progress/error, cancel and retry. Verify the shared contact's name/username and the failed-upload ownership behavior.
3. Record, stop, preview/play, seek, send, discard and slide left to cancel on mobile. Check microphone denial, the five-minute limit and progress/error presentation. Start a second audio message: the first must pause/reset. Leave the chat while playing: audio must stop.
4. Open message actions with right-click/overflow or mobile long-press. Test permitted reply/react/copy/forward/pin/edit/delete actions, edit errors, the five-chat forward cap and a retry, selected reaction removal, and keyboard dismissal/focus return.
5. Search from the header at widths ≥768px; at 375px use Chat options → Search in chat. Verify result navigation, highlights, Enter/Shift+Enter/Escape and the loaded-messages explanation.
6. Open image/video messages; check filename/caption, signed download, native video playback, close/backdrop/Escape and focus return. Use English and Spanish to check translated controls and text wrapping.

## Communities — Module 3A

Run pnpm review:ui and open **http://127.0.0.1:5177/tests/ui-foundation.html#communities-gallery**. This section uses pure production card/row/header/settings surfaces and the actual CreationDialog with fixture-local state. No login, provider, microphone or remote request is needed.

Repeat at **375 × 844**, **768 × 1024**, **1280 × 900**, in **Light and Dark**, for **blue, orange, green, purple, red and yellow** (36 combinations). Select the mode/accent at the top of the fixture, then return to the Communities anchor.

1. **Weekend friends card:** inspect the silver heading, rounded avatar, member count and three compact chat rows. Collapse/expand with pointer and Enter/Space. General shows a glowing count, Weekend plans a manual-unread dot, Photos a muted icon. Text should truncate neatly and no horizontal overflow should appear.
2. **Sidebar/header:** compare the active General icon and unread badge with Follow/Light above: identical accent gradient, white foreground in Light and near-black in Dark. Inspect the outlined New chat action, silver header, back/info/menu controls and card spacing. The fixture stacks its sidebar/detail preview below 900px to keep both samples visible; the real app retains its existing lg sidebar breakpoint (1024px).
3. **Info/settings:** inspect the silver details card, identity/avatar, member and mute rows, and destructive leave/delete color. Preview actions update a local notice only. They never operate on an account.
4. **Creation:** choose Open community creation preview. Inspect the rounded silver dialog, labeled name/description, outline Cancel and glowing Create preview community. Tab/Shift+Tab stay inside, Escape/cancel return focus, and submit closes with a local notice. Repeat at all three viewports; the dialog must fit the screen.
5. Recheck **#conversation-gallery** and **#interactive-gallery**: file-type tile rings, bubbles, composer controls and primary fills retain their approved appearance. The fixture stylesheet entry must load canonical styles before feature layers.

For actual behavior, log in through the normal application/auth setup on **your app origin** (the isolated 5177 server explains backend requirements instead of hosting accounts). Use real community/chat IDs:

| Route | Manual states and actions |
|---|---|
| /communities | Search/clear, empty/loading/error retry, persisted card expansion, signed avatar, unread/muted/count states, See all chats, existing group-glyph FAB. Create with/without photo; check nested avatar dialog, cancel/focus, and successful automatic General chat. |
| /communities/<communityId> | At 375/768px, full-width chat list; at 1280px, 320px sidebar plus select-chat pane. Check Back, info, New chat and real chat navigation. |
| /communities/<communityId>/chats/<chatId> | Community name/header/info/menu; one shared timeline/composer. Send and reply, react/edit according to permissions, search, audio and attachments; verify read/unread clears, back/navigation and optional scrollTo message remain functional. |
| /communities/<communityId>/info | Signed avatar and editable name/description per role; members/add/promote/demote/remove, mute/unmute, Create chat, leave/successor explanation and owner-only typed delete confirmation. Check busy/error retry and cancel/focus. |

Repeat live routes in both themes, all six accents and the three sizes above; check English/Spanish wrapping. Use owner/admin/member accounts to compare controls. Destructive actions should use disposable test communities. The screenshot-free mocked journey additionally verifies created-ID reuse after failed avatar update, read retry, role restrictions, successor warnings and delete outcomes and shared messaging reuse; no live backend deployment is certified by these tests.

Module 3A checks ran with a clean review-server start and fresh browser contexts on **5177**. Mocked community/shared-settings tests used **5175** to leave the existing **5173** app untouched. No screenshots or image artifacts were generated. **Stop at Module 3A; Module 3B remains deferred.**

### Fluid card disclosure feedback (F04/T036)

Start with **pnpm review:ui** and **http://127.0.0.1:5177/tests/ui-foundation.html#communities-gallery**. The fresh-server/fresh-browser procedure above applies; wait for any initial Vite dependency reload to settle.

- At **375 × 844**, **768 × 1024**, **1280 × 900**, in **Light/Dark** with **blue, orange, green, purple, red, yellow**, click Weekend friends repeatedly. Its chat list should smoothly grow/shrink and fade over **200ms** with the existing ease-out curve. The card divider disappears completely when closed; there is no trailing gap or snapped-away content. Rapidly reverse direction and check that it follows your input without a delayed replay. Other approved card colors/layout remain unchanged.
- Focus the heading and use **Enter/Space**. The disclosure state updates immediately. When closed, **Tab** must skip its chat rows and See all button; when open they remain reachable. Focus stays on the heading when toggling it.
- In DevTools Rendering, emulate **prefers-reduced-motion: reduce**. Both directions must become instant, without fade or height motion. Return to no-preference to restore animation.
- On **/communities on your authenticated app origin**, repeat the same checks with a populated card. Reload once expanded and once collapsed: the saved state must return. Expand an initially unloaded card and confirm its normal loading/error/retry behavior, chat counts/badges and See all navigation. The existing backend is required here; the review server on 5177 has no account data.

No screenshot artifacts are produced. The fixture demonstrates the shared transition; the mocked community browser suite also checks production row retention, persistence and focus. Module 3B remains deferred.

## Stories — Module 4A

Run **pnpm review:ui** and open **http://127.0.0.1:5177/tests/ui-foundation.html#stories-gallery**. The review server is account-free; the new section uses the actual story surfaces with local preview state. It has no remote images, microphone, media playback or autoplay. All navigation/progress examples are manually stepped.

Repeat in **375 × 844**, **768 × 1024**, **1280 × 900**, **Light/Dark**, and **blue, orange, green, purple, red, yellow** (36 combinations):

1. Inspect the compact horizontal row: Add story is silver with the approved neon camera tile; Sofia and My story have unseen rings/glow; Alex has a quiet seen ring. The plus control remains separate from opening My story. Hover/press should respond subtly without shifting the row layout or clipping the name.
2. Use Previous preview / Next preview and Pause preview story in the inline viewer. Progress changes only when stepped; Pause changes local feedback. Type a Preview story reply and send: the draft clears with a local notice and no request.
3. Open Preview unseen Sofia. The dark viewer is centered and rounded on desktop and full-screen on mobile. Inspect progress, identity, story text, navigation and glowing send. Open Preview viewers; Tab/Shift+Tab remain within the sheet. Escape closes it with a short downward fade and returns focus to Preview viewers. Close the viewer and check focus returns to its card.
4. Open Preview add story. Inspect the silver creator, text field and action buttons; type, cancel/save or Escape. Overlays enter/exit over 200ms with a small movement. Enable **prefers-reduced-motion: reduce** in DevTools Rendering: decorative movement and dismissal become instant. Repeat with keyboard controls.
5. Recheck the approved conversation, interactive and community galleries. Story styling should not change their layout, fills or motion.

For real behavior, log in through the normal backend setup and open **/novedades on your app origin**. Port 5177 is the isolated gallery, not an authenticated application. Its channels/discovery section intentionally remains in the prior presentation pending Module 3B.

- **Creation:** My story/Add story → Camera/Gallery/Text. Inspect selected mode styling, caption, photo/video preview, eight background swatches/custom color, character limits, upload progress, disabled/busy controls and cancel/focus return. Publish image/video/text; check 50 MB, 15-second video and ten-active-story limits. A failed publish retry reuses the existing story/upload IDs; the browser suite verifies this without creating duplicate media.
- **Viewing:** check seen/unseen order and rings, signed image/video loading and unavailable-media fallback. Text/images advance after five active seconds; video follows its bounded duration. Hold the stage, release, navigate Previous/Next, tap left/right, swipe down, hide/restore the tab and open a menu/sheet. Pauses should freeze progress and resume from the same point. Reduced motion disables decoration while retaining functional story playback/progress.
- **Replies:** type a reply to another person's story; focus/draft pauses playback. Send and verify the linked message reaches the direct chat once. Test a failure/retry when practical; automated mocked checks cover ambiguous success and reconciliation failure while preserving the same UUID and direct chat.
- **Ownership:** open your own viewers sheet, close it and check focus/timer resume. Only your own story exposes deletion. Test Cancel and Confirm on a disposable story, including busy/error feedback. End-of-group autoplay and successful publishing keep their original immediate completion behavior.
- Repeat live inspection at all three viewports, both themes and all six accents, including English/Spanish wrapping. Actual accounts/backend behavior beyond mocked boundaries still needs this manual review.

The screenshot-free stories gallery verifies all 36 combinations. The Novedades harness also covers existing channels as a regression check; no channel migration is included. **Stop at Module 4A; 4B and 3B remain deferred.**

## Live application review is a separate setup

For actual accounts, use the existing Netlify/auth setup in [authentication.md](authentication.md#dependencies-and-local-workflow), including its HTTPS/cookie and callback requirements. Plain pnpm dev and pnpm review:ui are not substitutes for that backend. This turn verified protected routes with mocked auth/data boundaries; it did not certify a live-account login deployment.

Once that normal application setup is working, inspect /chats, /chats?filter=archived, /chats?filter=unread, /communities and /settings/appearance on **that app's origin**, after normal login. Check search/back, request expansion, context-menu selection, FAB dialogs, and rail/tab navigation. These are optional application regression checks, not prerequisites for accepting the standalone visual fixture.

## Verification evidence and scope

See [review-path-evidence.md](review-path-evidence.md) for the original reproduction and clean-start results, and UI_MIGRATION_MAP.md §11 for Module 2A. The screenshot-free journey harness is tests/ui-review-path-browser.mjs. Module 2A adds tests/conversation-gallery-browser.mjs and preserves existing outcome assertions; focus/entry selectors account for asynchronous sheet closure and Vite module cache suffixes. Messaging harnesses also check reply restoration/reconciliation and failed upload ownership.

Module 2A migrates the read-only conversation frame/header/timeline/bubbles and extracts the five approved controllers. Module 2B now migrates composer/tools, audio player/recorder, action menus/modals, search UI, lightbox and reaction picker (UI_MIGRATION_MAP.md §15). Module 3A now migrates the community surfaces and extracts their workflows (UI_MIGRATION_MAP.md §16). Module 4A now migrates story surfaces (UI_MIGRATION_MAP.md §18); T123 is partial. Module 4B, 3B and unmatched screens remain deferred. Calls remains its existing placeholder. No auth bypass is included.

## Module 3B — broadcast channels (Novedades complete)

From a clean terminal/server state, stop the previous review instance with Ctrl+C, run **`pnpm review:ui`**, and open a fresh tab at **http://127.0.0.1:5177/**. It redirects to the offline fixture. Go directly to **http://127.0.0.1:5177/tests/ui-foundation.html#channels-gallery** for **Broadcast channels**, below Stories. No account, backend, providers or remote media are used here. Do not use the old 5187 port or a file:// URL.

Review **375 × 844**, **768 × 1024**, **1280 × 900**, each in **Light and Dark** with **blue, orange, green, purple, red and yellow**. Use the top fixture controls and devtools; no screenshots are required or generated.

- **Subscribed/discover rows:** rounded silver rows, verified name, muted description and compact metadata. The first subscribed sample has a glowing unread 12; the second has a quiet muted icon. Follow preview uses the same gradient as the foundation Follow button in both modes. Names/descriptions should wrap or truncate cleanly without horizontal page overflow.
- **Follow state:** Follow preview switches immediately to outlined Following preview with a short label fade. The info action changes with it; Mute preview notifications appears only while following and updates a local notice. Unfollow preview info reverses the state immediately.
- **Header/info:** inspect the shared silver conversation header, large avatar/profile card and quiet metadata. Preview owner account reveals Edit/Delete rows; turn it off and those rows disappear. This is fixture-only permission state, not an authenticated account.
- **Dialogs:** Create preview channel opens the rounded form; enter a valid name/slug and confirm for a local notice. In owner mode, open Edit and Delete. Tab stays inside; Escape/Cancel fades out and restores focus. Dialogs fit the viewport. Required fields remain browser-validated. No data is sent or deleted.
- **Motion:** rows/info reveal by 4px and fade over 200ms; follow labels and hover changes use 150ms, with the shared ease-out curve. Dialogs use the approved 200ms overlay motion. Emulate reduced motion: reveal, state changes and dismissal become instant. Follow/form actions do not wait for decorative motion.
- **Regression:** the approved Stories cards/viewer/sheet and shared Conversation/Interactive galleries should retain their appearance and behavior. The fixture intentionally has no channel message fork: the existing shared timeline/composer galleries cover those surfaces.

### Authenticated route review (requires the real backend)

The standalone server on **5177 is not the authenticated app**. Paths such as `/novedades` there explain the backend requirement. Use your existing app + Netlify auth backend and an owner/follower account. With the existing local frontend on **5173**, the routes below are **http://127.0.0.1:5173** plus each path; if your backend setup prints another app origin, use that origin consistently. The isolated **5175** server is only for intercepted browser tests with fake credentials and is stopped after verification.

1. **`/novedades`**: approved stories above followed/discover sections, brand/header/search, compact rows, neon unread badges and Create channel / Explore more actions. Filter by channel name/slug; confirm no changes to story filtering, order or playback.
2. **`/novedades/explore`**: discovery list and Back link. Follow a channel; it appears in subscribed channels and disappears from discovery according to the existing query rules. Confirm failed follow can still be retried.
3. **`/channels/<channelId>` — follower:** shared silver header and the existing timeline, paging, realtime, search and reactions; no posting composer. Options retain follow/unfollow, mute 8 hours/forever/unmute, copy link, mark unread and info. Unfollow hides posts; follow restores them. Re-entering updates the read cursor; a failed update exposes Retry marking channel read.
4. **Same route — owner:** the shared composer remains available, including its attachment/audio tools. Send a broadcast; it stays in that channel. Header Back returns to Novedades; search and info retain current URLs/history.
5. **`/channels/<channelId>/info` — compare accounts:** both see name, verification, signed avatar, slug, follower count, description/date and follow action; mute is available while following. Only the owner sees Change photo, Edit and Delete. Edit opens a focused dialog; save updates the card. Delete confirms the permanent action; cancellation returns focus. Use a disposable channel if testing deletion.
6. **Creation:** Create channel (or **`/channels/new`**) opens `/novedades?create=true`. Name generates slug until manually edited; taken slugs disable create, and failed availability checks can be retried through submission. Crop an optional avatar; Escape closes only the top dialog. After partial avatar failure, the created channel ID is reused and locked fields remain locked; Finish retries without duplication. Success opens its info route. **`/channels`** still redirects to `/novedades`.

Automated evidence: screenshot-free channel gallery covers all 36 combinations, focus/containment/reduced motion and local state with zero remote requests. Mocked Novedades tests cover owner/follower outcomes, failed cursor/availability/avatar paths, one create on retry, channel-mode sends, mute/read-unread, realtime, paging and existing stories. This verifies behavior with intercepted data; real account/storage/backend behavior still belongs to the manual live review above. Stop after Module 3B; Module 4B remains deferred.

## Module 4B-1 — settings shell & low-risk pages

Stop any previous standalone review instance in its terminal with Ctrl+C, run **`pnpm review:ui`**, then open a fresh tab at **http://127.0.0.1:5177/**. It redirects to the fixture. Open **http://127.0.0.1:5177/tests/ui-foundation.html#settings-gallery** for **Settings shell & preferences**, below Broadcast channels. This section uses the real pure settings surfaces with fixture-local state; it has no auth, backend, provider or remote-media requirement.

Review **375 × 844**, **768 × 1024**, **1280 × 900**, each in **Light/Dark** and **blue, orange, green, purple, red, yellow**. The gallery's Preview light/dark/system and Preview accent controls change the fixture tokens without saving. The top global fixture controls remain available. No screenshots are generated.

- **Shell/navigation:** silver top bar, framed sidebar and compact cards; sidebar appears above the existing 800px breakpoint and hides below it. The gallery links stay inside the fixture. The real app continues using URL navigation and browser history.
- **Appearance:** inspect the three theme miniatures, selected glow and six gradient swatches. Each selected swatch and checked switch should use the same fill as the foundation Follow button for that accent in either mode; no light-only muted fill. Tab focus is distinct from selection.
- **Rows/toggles:** Preview notifications disables Preview sound when off; reenabling restores control. Preview devices updates a local notice. Check compact text, wrapping, card borders and hover/press feedback without horizontal overflow.
- **Confirmation:** Preview read receipt confirmation opens a rounded native dialog. Tab/Shift+Tab stay inside. Escape/Cancel animate dismissal and restore focus; clicking the backdrop does not dismiss (existing contract). Turn on Preview pending save: actions disable and repeated Escape stays inside. Turn it off to cancel or confirm locally.
- **Motion:** page/section/dialog reveals use 200ms ease-out, row/control feedback 150ms. Emulate reduced motion: reveals and dismissal become instant. No decorative delay is added to preference saves or successful completion.

### Live settings routes — normal login and real backend required

Port **5177 is a review-only server**; settings paths there explain the backend requirement. Use your normal authenticated app/backend. With the existing frontend on **5173**, open **http://127.0.0.1:5173** plus the routes below; use your backend-served origin instead if your normal setup prints another origin. The fake-credential server on **5175** is only for intercepted automated tests and is stopped after verification.

1. **`/settings`** — your signed avatar/identity, Edit profile link, all current settings links and Log out. Desktop sidebar indicates the active page; mobile keeps index navigation. Open Appearance, use browser Back/Forward, then the page Back link. Existing deep links and deferred pages remain reachable.
2. **`/settings/appearance`** — Light/Dark/System, six accents and English/Español remain functional. Changes apply immediately and persist after the existing debounce and reload. Verify System follows the device setting. Theme preview, swatches, focus and glow should agree across modes.
3. **`/settings/notifications`** — master switch controls Sound, Message previews and preview availability. Preview respects sound and text privacy. These remain in-app controls; existing push-installation/coming-later text stays accurate.
4. **`/settings/privacy`** — existing blocked/photo/presence/stories links; disabling read receipts opens the warning. Keep enabled cancels without saving; Turn off saves and closes. Busy save blocks Escape/actions. Reenable directly as before.
5. **`/settings/privacy/visibility`**, including **`#photo`**, **`#stories`**, **`#presence`** — privacy radios, exception counts, searchable Hide from… contact selection and presence switch. Cancel preserves prior selection; Save persists. Verify contact-query error/retry behavior remains reachable.
6. **`/settings/devices`** — actual device name/activity and This device badge. Sign out all other devices opens confirmation; Cancel/Back/Escape preserve the session. Confirm deliberately signs out other sessions while keeping this one.
7. **`/settings/storage`** — actual total/category values, gradient usage indicator and the existing soft-indicator disclaimer. No prototype quota or invented storage data.
8. **`/settings/about`** — current package/build version, existing Terms/Privacy availability, expandable real license links and logout confirmation. Verify Cancel/focus restoration; only confirm logout if you intend to sign out. The all-other-devices checkbox retains its existing meaning.

At the 4B-1 boundary, profile/social/avatar, blocked/account/deletion, security/MFA and public profile were deferred. Those bodies and workflows are now covered by the Module 4B remainder checklist below. Automated mocked-backend outcomes verify behavior without changing accounts; normal-login manual acceptance remains the final visual/backend review.

## Module 4B remainder — profile, account, security and public profile

### Clean standalone review procedure

From the repository root, stop an existing **review-only** server if it occupies 5177, then run **`pnpm review:ui`**. Leave the normal app/backend alone. Open a fresh browser tab at **http://127.0.0.1:5177/**; it redirects to **http://127.0.0.1:5177/tests/ui-foundation.html**. Jump directly to **http://127.0.0.1:5177/tests/ui-foundation.html#settings-details-gallery**. Expect **Profile, account & security** below **Settings shell & preferences**. No login, environment file or backend is required. This path was exercised after restarting the review server, using fresh browser contexts, with no auth/remote requests or screenshots.

Use the top **Light/Dark** and **Accent** controls (or the preceding settings gallery preview controls). Check **blue, purple, red, orange, yellow, green**, each in both modes at **375×844**, **768×1024**, **1280×900**. At narrow widths the two gallery columns stack. Cards, public identity/bio, forms and dialogs must stay within the viewport.

- **Profile/social:** edit the local name/bio and Portfolio field; Save preview profile/links shows a local notice. Username is read-only with a 30-day cooldown example. Focus rings, card borders and primary glow follow the selected theme/accent.
- **Avatar:** Preview photo picker opens the same SettingsDialog frame used by the app. Camera/upload preview shows a local crop frame and Zoom slider (no camera/file access). Preview save with cleanup warning closes and displays the pending-cleanup notice. Cancel/Escape restore focus after the subtle exit. Test Tab/Shift+Tab confinement and reduced-motion instant dismissal.
- **Blocked/rollback:** Preview unblock temporarily removes the anonymized contact. Simulate unblock failure restores User 22222222 and exposes an error. This is a deterministic fixture state, not a backend request.
- **Account/deletion:** inspect the scheduled-deletion banner and destructive card. Preview delete confirmation keeps Schedule preview deletion disabled until exact **DELETE**. Cancel/Escape animate; backdrop clicks retain the dialog. Preview email/cancel-deletion actions only update local text.
- **Security:** Preview backup codes shows ten clearly marked DEMO codes and the same BackupCodesSurface. Copy/download preview only acknowledge locally. Escape/backdrop cannot dismiss; Done stays disabled until **I’ve saved these demo codes** is checked. The real navigation blocker is verified in the authenticated mocked harness; the fixture demonstrates the mandatory dialog without a router.
- **Public profile:** inspect the soft accent banner, overlapping avatar, name/handle, bio, social pills and glowing message action. Preview message request only shows a notice. No invented status/role/verification data appears.
- **Motion:** existing settings entry/exit is 200ms ease-out; controls 150ms. Emulate `prefers-reduced-motion: reduce`: decorative motion is instant. No save, auth or MFA timing depends on animation.

### Live routes — normal authenticated backend required

**5177 serves the fixture, not the app.** Visiting /settings/* or /profile/* there intentionally shows the backend guide. The existing app frontend is **http://127.0.0.1:5173**; log in through your normal backend-enabled origin (use that origin instead if your backend prints a different one). The isolated fake-credential server on **5175** is only used with automated request interception and is stopped after verification.

At the same viewport/theme/accent matrix, review:

1. **http://127.0.0.1:5173/settings/profile** — existing name/bio/first/last fields and signed photo. Validation, disabled/dirty Save and reload persistence; a recent username change stays read-only until its existing 30-day date. Change photo: view, choose/crop/zoom/save, remove and Cancel/Escape. An old-object cleanup failure reports a warning while retaining the saved new photo. Camera availability remains device-dependent.
2. **http://127.0.0.1:5173/settings/profile/social** — fixed fields and bounded custom labels/values, removal, saved values after reload. Unsafe schemes remain text when rendered on the public card.
3. **http://127.0.0.1:5173/settings/privacy/blocked** — anonymized identities, counts, empty state and Unblock. Automated checks hold/fail the request to verify optimistic removal and rollback; normal successful unblock persists.
4. **http://127.0.0.1:5173/settings/account** — current email, security link, account-switch explanation, typed DELETE confirmation and cancellation banner. Email change still requires the delivered confirmation link. Cancel dialogs to review harmlessly; confirming email, logout or deletion intentionally performs the existing account operation. Deletion remains scheduled for 30 days and cancellation remains unavailable after the deadline.
5. **http://127.0.0.1:5173/settings/security** — existing authenticator enrollment QR/setup key and six-digit verification, enabled state, regeneration/disable confirmations. If deliberately testing enrollment, save the displayed backup codes; Escape/backdrop/navigation/reload stay blocked until acknowledgment **and Done**. Copy reports success or download fallback; Download produces the existing .txt. Partial hash-write failure explicitly reports enabled 2FA and offers regeneration. Automated checks cover this without modifying remote accounts. Existing security body copy remains English as before; translated page heading/description remain intact.
6. **http://127.0.0.1:5173/profile/<username>** — use your own username for Edit profile and a visible other profile for Send message. Safe social links open separately; unsafe values remain inert. A request navigates to its returned chat. Hidden/unavailable profiles retain the existing privacy-aware empty view.

### Verification commands for this slice

`pnpm exec tsc --noEmit -p tsconfig.app.json`, `pnpm typecheck`, `pnpm test`, `pnpm exec vite build`, and `pnpm exec biome check <changed-source-and-test-paths>`.

For browser suites, use an installed Chromium and Playwright Core via `CHROMIUM_PATH` / `PLAYWRIGHT_MODULE_PATH` where required. Review suites use `UI_REVIEW_URL=http://127.0.0.1:5177`; foundation uses `UI_BASE_URL=http://127.0.0.1:5177`. Run `node tests/ui-review-path-browser.mjs`, `node tests/ui-foundation-browser.mjs`, `node tests/primary-fill-browser.mjs`, `node tests/settings-gallery-browser.mjs`, `node tests/settings-details-gallery-browser.mjs`, plus communities/stories/channels gallery suites. These are screenshot-free.

The mocked app is started separately with `VITE_SUPABASE_URL=https://supabase.test`, `VITE_SUPABASE_ANON_KEY=test-anon`, **`pnpm dev --port 5175`**. With `UI_BASE_URL=http://127.0.0.1:5175`, run `node tests/settings-browser.mjs` and `node tests/chat-settings-browser.mjs`; run `node tests/communities-browser.mjs` (default 5175), and `node tests/novedades-browser.mjs` with `TEST_BASE_URL=http://127.0.0.1:5175`. All remote boundaries are intercepted. No manual sign-in to this fake-credential server is intended.

Module 4B is complete. Module 5 remains deferred pending explicit authorization.

## Module 5A — chat settings & chat info

### Clean standalone review (no login/backend)

From the repository root, stop any old **review-only** servers (including a stale 5187 instance), leave the normal app/backend alone, then run:

```powershell
pnpm review:ui
```

Use only one review server, on **5177**. Open a fresh browser tab at **http://127.0.0.1:5177/**, then **http://127.0.0.1:5177/tests/ui-foundation.html#chat-settings-gallery**. Expect **Chat settings & info** after **Profile, account & security**. This procedure was exercised after stopping both old review processes and restarting 5177; fresh browser contexts verified the new section, redirects, and backend-guide routes without console errors or auth/remote requests. The earlier stale-dependency 504 was caused by concurrent review processes sharing the Vite review cache; no configuration change was needed. No screenshots are generated.

Use the top **Light/Dark** and **Accent** controls. Review **blue, purple, red, orange, yellow, green**, in both modes at **375×844**, **768×1024**, **1280×900** (36 combinations). The two gallery columns stack on mobile. Inspect:

1. **Info and members:** editable local group name/description, count/date card, three member rows, role pills and compact actions. Cards and long labels fit the viewport, with consistent 4B borders, focus and hover/press feedback.
2. **Menu:** open the chat-options sample. Desktop menu stays within the viewport; mobile uses the bottom sheet. Arrow Up/Down, Home/End, Enter, Escape and Tab work. Dismissal restores focus; reopening during its exit remains responsive. Destructive choices are visibly separated.
3. **Contact:** open the local contact dialog. Check the shared profile banner, avatar, identity and action hierarchy. Tab/Shift+Tab stay inside; Cancel/Escape dismiss with subtle motion and restore focus. Fixture actions only update local state.
4. **Confirmations:** try Add members, mute, clear, leave and report samples. Select a member; Other report reason requires details. Turn on the preview pending state: buttons disable and repeated Escape keeps the dialog open; turn it off to cancel/confirm locally. The fixture does not modify accounts, chats or memberships.
5. **Media/files:** switch tabs with pointer and arrow keys; open a local media preview. Inspect the six PDF/Word/spreadsheet/presentation/archive/text tiles. The misleading **notes.txt** example remains Word-colored because its MIME type wins. Long filenames truncate visually while retaining their full title. Gallery media are CSS placeholders, not signed remote assets.
6. **Motion:** dialogs use the existing 200ms ease-out entry/exit; menu, tab and row feedback is 150ms. Emulate `prefers-reduced-motion: reduce`: decorative entry/exit becomes instant. No save/navigation waits for animation. Confirm no horizontal page overflow at all three widths.

### Live routes — normal login and real backend

**5177 is fixture-only**: `/chats/...` there intentionally displays the backend guide. Use **http://127.0.0.1:5173** with your normal authenticated backend, or your normal backend-enabled origin if different. The isolated fake-credential server on **5175** is for intercepted automated tests only and is stopped after verification.

At the same viewport/theme/accent matrix:

1. **`/chats/<groupId>/info`** — signed group avatar, name/description, count/date and links. Admin edits retain validation and persistence; nonadmins retain existing permissions. Avatar editing still uses its existing crop/privacy workflow.
2. **`/chats/<groupId>/members`** — searchable/current members, roles, creator protections, Add members and allowed promote/demote/remove actions. Confirmations preserve focus and busy guards. Cancel for harmless review; confirm membership changes only when intended.
3. **`/chats/<chatId>/media?tab=media`** and **`?tab=files`** — URL/back behavior, keyboard tabs, loading/error/empty states, paginated signed thumbnails, lightbox navigation and signed downloads. Inspect actual document-family colors and long filenames.
4. **In-conversation settings layer:** direct/group/self chats retain available options, translations and counts. Search still reaches the existing search action. Test mute durations/unmute, pin/unpin and mark unread; successful unread navigation returns to chats. Clear/report/leave confirmations preserve their existing effects and busy guards. Review destructive dialogs with Cancel unless you intend the action.
5. **Contact profile:** signed/privacy-filtered identity and social links; Message reuses an existing chat or creates one request/self-chat and navigates once. Calls retain their existing unavailable/coming-soon explanation. Block/report/full-profile entry points stay reachable.
6. **Communities regression:** open `/communities`, then a community's group info and members surfaces. Confirm the same card/member presentation, role controls and shared Conversation layer; no duplicate community-only screen was introduced.

### Screenshot-free verification commands

Run the standard gates:

```powershell
pnpm exec tsc --noEmit -p tsconfig.app.json
pnpm typecheck
pnpm test
pnpm exec vite build
pnpm exec biome check <changed-source-and-test-paths>
```

Where Playwright Core/Chrome are not locally discoverable, this workstation uses:

```powershell
$env:PLAYWRIGHT_MODULE_PATH='file:///C:/Users/Mystic/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs'
$env:CHROMIUM_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
$env:UI_REVIEW_URL='http://127.0.0.1:5177'
$env:UI_BASE_URL='http://127.0.0.1:5177'
node tests/ui-review-path-browser.mjs
node tests/chat-settings-gallery-browser.mjs
node tests/ui-foundation-browser.mjs
node tests/primary-fill-browser.mjs
node tests/settings-details-gallery-browser.mjs
node tests/communities-gallery-browser.mjs
node tests/channels-gallery-browser.mjs
```

For mocked authenticated outcomes, in a separate shell start:

```powershell
$env:VITE_SUPABASE_URL='https://supabase.test'
$env:VITE_SUPABASE_ANON_KEY='test-anon'
pnpm dev --port 5175
```

With the same Playwright/Chrome environment, run:

```powershell
$env:UI_BASE_URL='http://127.0.0.1:5175'
$env:TEST_ORIGIN='http://127.0.0.1:5175'
$env:TEST_BASE_URL='http://127.0.0.1:5175'
node tests/chat-settings-browser.mjs
node tests/communities-browser.mjs
node tests/novedades-browser.mjs
```

All remote boundaries in these app suites are intercepted; no real account mutation or screenshot is required. Stop the isolated 5175 server afterward. Module 5A stops here; 5B, 5C and deferred global cosmetic work await authorization.

## Module 5B — auth, onboarding, landing and infrastructure

### Clean standalone review

Leave the normal app/backend running. Stop any existing **review-only** server, then from the repository root run **`pnpm review:ui`**. Open a fresh tab at **http://127.0.0.1:5177/**, which redirects to the fixture, then visit **http://127.0.0.1:5177/tests/ui-foundation.html#auth-gallery**. Expect **Auth, onboarding & infrastructure** after **Chat settings & info**: a landing hero and ten auth/onboarding/state cards. This procedure was exercised with a restarted review server and fresh browser contexts. No login, credentials, providers or remote requests are needed; no screenshots are produced.

Review **375×844**, **768×1024**, **1280×900**, each in **Light/Dark** and **blue, purple, red, orange, yellow, green** using the top fixture controls. Gallery preference controls are local demonstrations and do not persist or replace the top theme controls.

- **Landing:** glowing S with white glyph, silver/accent wordmark, original headline/copy and conversation illustration. Links remain within the gallery in preview mode. Inspect the stacked mobile layout and desktop two-column balance.
- **Login/signup:** email label/icon/input alignment, visible focus, primary glow, wrapping and disabled state. Preview send/create only updates a local notice; no email or account is created. The signup sample explicitly identifies the real CAPTCHA requirement.
- **MFA:** enter or paste six digits, including pasted separators; Backspace from an empty cell moves focus backward. Toggle code error, switch to backup code and back (OTP clears). Preview pending request disables verification and mode switching.
- **Email/recovery:** check-email sample shows disabled cooldown; expired-link sample provides recovery. Real timers and requests are tested separately in the mocked app journey.
- **Onboarding:** edit Preview username and inspect the live handle. Select local appearance/accent, then Preview get started or skip. Pending state disables completion controls. Inspect long headings and all six selected accent states.
- **Infrastructure:** loading skeleton, outage alert, privacy-empty text, retry, not-found and existing account-destination samples. Preview session expired opens the native nondismissible dialog: Escape/backdrop cannot close it, Tab/Shift+Tab remain inside, and Preview return to login closes it and restores focus.
- **Motion:** card/section/session-dialog entry is 200ms ease-out; control and outage feedback is 150ms. Emulate reduced motion: decorative movement becomes instant. Functional login/resend/navigation timing never waits for animation.

### Live public/auth routes — normal backend required

**5177 is exclusively for fixtures.** `/auth/*`, `/onboarding/*`, `/calls` and other app routes on 5177 show the backend guide; they never create a session. Plain Vite does not implement `/api/auth/*`. Use your existing Netlify-BFF-enabled development or deployed origin. If that setup uses the existing frontend on **http://127.0.0.1:5173**, use that origin; otherwise substitute the backend-enabled origin it prints. Do not sign in to the intercepted test server on 5175.

At the same viewport/theme/accent matrix:

1. **`/` logged out:** original landing copy, login/signup destinations, header and illustration. Logged-in navigation still sends you through the existing MFA/username/chat destination logic.
2. **`/auth/login`:** empty/invalid email errors and associated label; successful magic-link request, busy state and recovery from request failure. A protected URL retains its local query/hash return path; external redirects are sanitized. Real email delivery needs the existing BFF configuration.
3. **`/auth/signup`:** the same card/control language, actual Turnstile challenge and required token. With no site key, the unavailable message and disabled Create account remain intentional. Verify a real signup only with an account you intend to create.
4. **`/auth/check-email`:** displayed email, 60-second resend cooldown, resend feedback/failure and Change email. Open the delivered link in the same browser. **`/auth/post-login`** preserves callback cleanup, skeleton and safe onward navigation.
5. **`/auth/2fa-verify` for an MFA-required session:** six-digit keyboard/paste/backspace, invalid-code recovery, automatic verification, backup-code toggle/reset and busy controls. Completing MFA retains AAL2 on reload. Backup recovery retains the re-enrollment reminder. CodeInput props/behavior are unchanged.
6. **`/onboarding/pick-username` for an eligible account:** invalid/taken/racing usernames, username error text and live handle, save/refresh then welcome. This is not a username-change bypass; existing guards and cooldown semantics remain. **`/onboarding/welcome`:** saved theme/accent hydration, six accent choices, language, save failure/retry and Skip for now. Get started saves the existing preference payload and safely redirects; skip preserves its original meaning.
7. **`/auth/error?code=expired_token`**, **`?code=rate_limited`** and an unknown path such as **`/missing-route`**: recovery cards, Request a new link, Go back and Return home. A lazy-load failure shows a generic error card with retry/home actions instead of internal error details.
8. **Session/startup/outage:** session expiry keeps its nondismissible login dialog and return URL. Startup failure shows Let’s reconnect/Try again. Service outages retain the translated alert and existing half-open probe/focus-refetch behavior. These failures are exercised automatically; no live outage is required for review.
9. **`/calls` and `/profile` after login:** existing account-ready placeholders with Settings and Sign out. No calling backend or new profile capability is introduced. An unavailable **`/profile/<username>`** retains privacy-filtered content; loading/error/retry use the shared skeleton/notice treatment.

### Verification commands and boundaries

```powershell
pnpm exec tsc --noEmit -p tsconfig.app.json
pnpm typecheck
pnpm test
pnpm test:auth
pnpm exec vite build
pnpm exec biome check <changed-source-and-test-paths>
```

On this workstation, set browser paths when they are not otherwise discoverable:

```powershell
$env:PLAYWRIGHT_MODULE_PATH='file:///C:/Users/Mystic/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs'
$env:CHROMIUM_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
$env:UI_REVIEW_URL='http://127.0.0.1:5177'
$env:UI_BASE_URL='http://127.0.0.1:5177'
node tests/ui-review-path-browser.mjs
node tests/auth-gallery-browser.mjs
node tests/ui-foundation-browser.mjs
```

For intercepted auth/infrastructure/shared-state outcomes, start the separate test frontend in another shell:

```powershell
$env:VITE_SUPABASE_URL='https://supabase.test'
$env:VITE_SUPABASE_ANON_KEY='test-anon'
$env:VITE_TURNSTILE_SITE_KEY=''
pnpm dev --port 5175
```

Then, with the browser paths above:

```powershell
$env:UI_BASE_URL='http://127.0.0.1:5175'
node tests/auth-browser.mjs
node tests/auth-infrastructure-browser.mjs
node tests/settings-browser.mjs
```

All auth/data calls in those suites are intercepted; they do not create real accounts or send email. The infrastructure suite deliberately aborts one lazy module to verify the error boundary. The browser signup check verifies the missing-CAPTCHA gate; the 33 auth-BFF unit cases cover actual CAPTCHA validation, cookie/session and callback boundaries. Stop the isolated 5175 server afterward. Keep at most one review server on 5177.

Module 5B stops here. Module 5C cleanup, legacy CSS removal, reference removal and a final global regression pass require separate authorization.
