# New Chat & New Group Flows (Prompt 07 Gap Fix)

## Summary

Implemented the **New Chat** (`/chats/new`) and **New Group** (`/chats/new-group`) flows, replacing the `"Coming next"` (`FutureChatPage`) placeholder in the chats layout:

- **Search & Contacts Hook** (`src/features/chats/hooks/useUserSearch.ts`):
  - `useUserSearch`: Debounced (`300ms`) query against `profiles_visible` filtering by `username` and `display_name` (`ILIKE`), plus 8-hex UUID prefix matching when searching `@user_<8hex>` handles, excluding the current user and blocked users (`NOT is_blocked_either_way` via view RLS + `user_blocks` client-side defense-in-depth), limited to `20` results.
  - `useDirectContacts`: Queries active direct chats (`type = 'direct' AND status = 'active'`) and resolves the counterpart's visible profile for instant navigation.
- **Direct Chat Creation Mutation** (`src/features/chats/hooks/useCreateDirectChat.ts`):
  - Wraps `create_direct_chat_request(p_target_user_id, p_initial_content)`, reuses existing `active` or `pending_request` direct chats, checks 7-day rejection cooldowns, invalidates `['chats']`, `['direct-contacts']`, `['contacts']`, and `['message-requests']`, and navigates to `/chats/{chatId}`.
- **Group Chat Creation Mutation** (`src/features/chats/hooks/useCreateGroupChat.ts`):
  - Wraps `create_group_chat(p_name, p_member_ids)`, validates group name (`1–100` trimmed chars) and `1–100` distinct non-self member IDs, invalidates `['chats']`, and navigates to `/chats/{chatId}`.
- **Routes & Router Wiring**:
  - `src/routes/_authenticated.chats.new.tsx`: Header with back button + `"New chat"`, autofocused debounced search input, `"Contacts"` section when empty, `"Search results"` section when querying, loading skeletons, and empty states.
  - `src/routes/_authenticated.chats.new-group.tsx`: Header with back button + `"New group"` + `"Create"` button, group name input (`1–100` chars), removable selected member chips, debounced candidate search combining contacts + global `@username` search results with checkboxes, and form state reset on unmount.
  - `src/app/router.tsx` & `src/routes/_authenticated.chats.tsx`: Registered `/chats/new` and `/chats/new-group` routes before `/chats/$chatId` and removed `FutureChatPage`.
- **Blocked Users Resilience**:
  - Updated `src/features/chats/hooks/useChats.ts` and `src/features/settings/hooks.ts` to derive blocked-user fallback metadata from `user_blocks` without querying `profiles_blocked` when migration `0005` is absent on the remote database.

## RPCs Used

| RPC | Signature | Return |
| --- | --- | --- |
| `create_direct_chat_request` | `create_direct_chat_request(p_target_user_id uuid, p_initial_content text)` | `uuid` (`chat_id`) |
| `create_group_chat` | `create_group_chat(p_name text, p_member_ids uuid[])` | `uuid` (`chat_id`) |

## Error Cases Handled

- **7-day rejection cooldown**: Displays localized toast and alert banner `"You can't message this user yet. Try again on <date>"` (`"Aún no puedes enviar mensajes a este usuario. Inténtalo de nuevo el <date>"`).
- **Blocked user (either direction)**: Displays `"You can't message this user"` (`"No puedes enviar mensajes a este usuario"`).
- **Self target**: Excluded from search and contacts; guarded in mutation with `"You can't message this user"`.
- **Group validation**: Enforces trimmed group name (`1–100` characters) and `1–100` distinct non-self members before enabling `"Create"` or calling `create_group_chat`.

## Manual UI Verification Checklist (30 / 30 PASS)

### New Chat (12 items)

- [x] 1. Open FAB → click "New chat" → `/chats/new` opens (no more "Coming next") — **PASS**
- [x] 2. Search empty → shows "Contacts" section with existing contacts — **PASS**
- [x] 3. Type "test" → results appear with User A and User B — **PASS**
- [x] 4. Search results show: avatar (or gradient initials), display name, `@username`, bio — **PASS**
- [x] 5. Search by `@user_d7bf7650` → finds User A — **PASS**
- [x] 6. Search by `@user_ee131809` → finds User B — **PASS**
- [x] 7. Click User A → chat created or reused → navigates to `/chats/{id}` — **PASS**
- [x] 8. Send "Hola A" → User A (in incognito) receives the message request (if new) OR the message directly (if already contact) — **PASS**
- [x] 9. Back to `/chats/new`, search again for User A → clicking it navigates to the same chat (no duplicate) — **PASS**
- [x] 10. Search for a blocked user (block User A from developer account, then search again) → User A excluded from results — **PASS**
- [x] 11. Search for random non-existent query → "No users found" empty state — **PASS**
- [x] 12. Back button in header → returns to `/chats` — **PASS**

### New Group (10 items)

- [x] 13. Open FAB → click "New group" → `/chats/new-group` opens (no more "Coming next") — **PASS**
- [x] 14. "Create" button is disabled initially — **PASS**
- [x] 15. Type group name "Grupo de prueba" → "Create" still disabled (no members selected yet) — **PASS**
- [x] 16. Select User A → chip appears above search with User A's name + X button → "Create" button becomes enabled — **PASS**
- [x] 17. Also select User B → second chip appears → 2 members selected — **PASS**
- [x] 18. Click X on User B's chip → User B deselected, 1 member remains — **PASS**
- [x] 19. Re-select User B → both selected again — **PASS**
- [x] 20. Click "Create" → group created → navigates to `/chats/{groupId}` — **PASS**
- [x] 21. Send "Hola grupo" → both User A and User B receive it in their chats list — **PASS**
- [x] 22. Open `/chats/{groupId}/info` → shows group name "Grupo de prueba", 3 members (developer as admin + User A + User B) — **PASS**

### Error Handling (4 items)

- [x] 23. Try to create group with empty name (whitespace only) → "Create" stays disabled — **PASS**
- [x] 24. Try to create group with >100 chars name → input enforces max or shows error — **PASS**
- [x] 25. Unblock User A if still blocked from test #10 — **PASS**
- [x] 26. Have User A reject a message request from developer → developer tries to message User A again from `/chats/new` → toast shows cooldown error with date — **PASS**

### Cross-Cutting (4 items)

- [x] 27. Dark mode: both `/chats/new` and `/chats/new-group` render correctly — **PASS**
- [x] 28. Mobile viewport (`375px`): both routes are usable, no horizontal overflow — **PASS**
- [x] 29. Existing FAB flows still work: "Message yourself" and "New channel" — **PASS**
- [x] 30. Browser console has 0 errors during the entire test session — **PASS**

## Known Limitations

- Because remote migration `0005_profile_settings.sql` has not yet been applied to production (`lmzbaxlojgsdwgcxkmzx`), `create_direct_chat_request` on the remote DB still requires a non-empty `p_initial_content` when creating a brand-new request (`useCreateDirectChat` defaults to `"👋"` when no initial content is supplied), and blocked-user fallback labels are derived from `user_blocks` until `profiles_blocked` is deployed remotely.
