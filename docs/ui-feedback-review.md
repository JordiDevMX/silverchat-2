# Feedback turn: manual browser review

Run `pnpm dev` with the normal local app configuration. Use the origin printed by Vite and the paths below. The foundation fixture needs no login; application routes use your normal authenticated session. No screenshots are needed.

## Viewports and themes

- Inspect 375 × 844 (mobile), 768 × 1024 (tablet), and 1280 × 900 or wider (desktop). Also cross 1023/1024px to check bottom tabs changing into the rail.
- Check light and dark mode with blue, orange, green and purple; also check yellow and red for contrasting text/glyphs.
- In the fixture, use its Light/Dark buttons and Accent selector. In the app, choose these in `/settings/appearance`, then return to the reviewed route.
- Emulate reduced motion and use Tab/Enter/Space once. Glows should remain static; focus must stay distinguishable.

## `/tests/ui-foundation.html`

1. **Bubble surfaces** and the **bubble-self** tile: light mode has pale accent fill and a softer visible halo; dark mode has gradient fill, bright rim and diffuse glow. The other bubble remains unlit. Change accents and confirm the fill and halo follow them.
2. **Chats header preview**: inspect the white S tile, foreground “ilver,” accent “Chat,” and separate small Chats heading. No Select/Refresh/PWA control should appear.
3. Search: inspect the metallic surface at rest and while typing; no gray outline box. Tab into the field to see its intentional focus indicator; clear entered text.
4. **Message requests** starts closed with a count. Open and close it by click, Enter and Space. Content should appear only when expanded.
5. **Tab actions**: compare chat-plus, phone-plus, group and broadcast glyphs. Confirm accent-filled squircle tiles, dark glyphs and static halo, without a surrounding ring. Keyboard focus brightens the tile and thickens the glyph. Calls/Updates here are presentation previews, not live creation features.

## `/chats`

1. Check the brand header and clean search at all widths. Select/Refresh buttons are absent. The screen keeps its separate Chats heading.
2. With incoming requests, confirm no previews show initially. Expand, collapse and navigate away/back to check the default. Request acceptance/decline are real actions; use suitable test data if exercising them.
3. Type a search, clear it, switch filters and use browser Back. Try `/chats?filter=archived` to inspect archived search, and `/chats?filter=unread` for unread state.
4. Right-click a chat (or long-press on touch), choose Select, then select a range with Shift on desktop. Exit selection; the FAB should return. Keyboard users can open the chat menu with Shift+F10.
5. Open the chat-plus FAB and close its existing menu with Escape/Cancel. On mobile, check that focus restoration leaves no ring around the tile and the tile clears the bottom tabs. Creation actions remain wired; no new PWA action was added.
6. Check one navigation instance, active glow, unread badge, desktop hover/keyboard labels and the five current URLs. Scroll the list to verify floating controls remain usable.

## `/communities`

Check the group creation glyph and matching FAB styling at the same widths/themes. Open and cancel the existing creation dialog. The community list itself has not been redesigned in this feedback turn.

## Scope boundary

`/calls` remains its current placeholder. Existing messages/composer have not been migrated; the new own-bubble treatment is established in the shared primitive and fixture for that later module. Authentication guards, onboarding, session handling and the deletion banner retain their existing contracts. Stop here for visual acceptance before Module 2.
