# Verified UI review procedure

## Start here — no account or backend needed

1. Open a terminal in the SilverChat repository. Stop any previous review server in its own terminal with Ctrl+C.
2. Run exactly:

```text
pnpm review:ui
```

3. Wait for Vite to print `http://127.0.0.1:5177/` and its UI review link. Keep that terminal open.
4. Open **http://127.0.0.1:5177/** in your browser. It redirects to **http://127.0.0.1:5177/tests/ui-foundation.html**.

You should see the SilverChat brand, Light/Dark buttons, an Accent selector, the neon action examples, two message-bubble samples, a Chats header with metallic search, a closed Message requests section, four tab-action tiles, and the **Conversation timeline** gallery. This uses the real migrated components. It does not mount the app/auth providers, load .env files, require Supabase credentials, or contact the auth backend.

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

## Live application review is a separate setup

For actual accounts, use the existing Netlify/auth setup in [authentication.md](authentication.md#dependencies-and-local-workflow), including its HTTPS/cookie and callback requirements. Plain pnpm dev and pnpm review:ui are not substitutes for that backend. This turn verified protected routes with mocked auth/data boundaries; it did not certify a live-account login deployment.

Once that normal application setup is working, inspect /chats, /chats?filter=archived, /chats?filter=unread, /communities and /settings/appearance on **that app's origin**, after normal login. Check search/back, request expansion, context-menu selection, FAB dialogs, and rail/tab navigation. These are optional application regression checks, not prerequisites for accepting the standalone visual fixture.

## Verification evidence and scope

See [review-path-evidence.md](review-path-evidence.md) for the original reproduction and clean-start results, and UI_MIGRATION_MAP.md §11 for Module 2A. The screenshot-free journey harness is tests/ui-review-path-browser.mjs. Module 2A adds tests/conversation-gallery-browser.mjs and preserves existing outcome assertions; focus/entry selectors account for asynchronous sheet closure and Vite module cache suffixes. Messaging harnesses also check reply restoration/reconciliation and failed upload ownership.

Module 2A migrates the read-only conversation frame/header/timeline/bubbles and extracts the five approved controllers. Module 2B presentation remains deferred: composer/tools, audio player/recorder, action menus/modals, search UI, lightbox and reaction picker. Calls remains its existing placeholder. No auth bypass is included.
