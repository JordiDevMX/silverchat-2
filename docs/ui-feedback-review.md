# Verified UI review procedure

## Start here — no account or backend needed

1. Open a terminal in the SilverChat repository. Stop any previous review server in its own terminal with Ctrl+C.
2. Run exactly:

```text
pnpm review:ui
```

3. Wait for Vite to print `http://127.0.0.1:5177/` and its UI review link. Keep that terminal open.
4. Open **http://127.0.0.1:5177/** in your browser. It redirects to **http://127.0.0.1:5177/tests/ui-foundation.html**.

You should see the SilverChat brand, Light/Dark buttons, an Accent selector, the neon action examples, two message-bubble samples, a Chats header with metallic search, a closed Message requests section, and four tab-action tiles. This uses the real migrated components. It does not mount the app/auth providers, load .env files, require Supabase credentials, or contact the auth backend.

**Do not double-click the HTML file or open a file:// URL.** Browsers cannot run this TypeScript/ESM fixture directly from disk. The HTML now displays the command and working HTTP link if its module cannot load.

If startup says `Port 5177 is already in use`, the new server did not start. Stop the previous instance in its terminal, then run the command again. Do not assume an already-open tab is the new server, and do not guess another port. Both review and app dev commands now use strict ports.

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
2. **Chats header preview**: inspect the white S tile, foreground “ilver,” accent “Chat,” and separate small Chats heading. No Select/Refresh/PWA control should appear.
3. Search: inspect the metallic surface at rest and while typing; no gray outline box. Tab into the field to see its intentional focus indicator; clear entered text.
4. **Message requests** starts closed with a count. Open and close it by click, Enter and Space. Content should appear only when expanded.
5. **Tab actions**: compare chat-plus, phone-plus, group and broadcast glyphs. Confirm accent-filled squircle tiles, dark glyphs and static halo, without a surrounding ring. Keyboard focus brightens the tile and thickens the glyph. Calls/Updates here are presentation previews, not live creation features.


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

See [review-path-evidence.md](review-path-evidence.md) for the reproduction and clean-start results. The new screenshot-free journey harness is tests/ui-review-path-browser.mjs; existing foundation and application harness assertions remain unchanged.

Calls remains its existing placeholder. Existing message views/composer have not been migrated; the own-bubble treatment is available in the primitive and fixture. No Module 2 work or auth bypass is included.
