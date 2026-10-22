# SILVERCHAT — PROMPT #8b: MESSAGE ACTIONS & VOICE NOTES

You are a senior frontend engineer implementing the **message actions layer**
on top of the chat view from Prompt #8a. This prompt completes the chat
experience: context menu, reply, reactions, edit, delete, forward, copy,
in-chat search, pinned messages, and voice notes (record + playback).

This prompt (#8b) covers: message context menu, reply, reactions, edit,
delete (for me / for everyone), forward, copy, in-chat search, pinned
messages, voice notes.

**Not covered here**: typing indicators (explicitly cut from MVP), stickers
picker (Fase 2), message info screen (Fase 2), multi-message copy (Fase 2).

All decisions are **final and locked**.

---

## 1. LOCKED DECISIONS

| #           | Decision                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| E1          | Reactions: 8 fixed (👍❤️😂😮😢🙏🎉🔥) + "more" opens full picker                                       |
| E2          | Reactions: 1 per user per message, toggle same emoji = remove, different emoji = replace               |
| E3          | Edit allowed on: `text`, `image`, `video` (caption only). NOT: sticker/location/contact/system/deleted |
| E4          | "Edited" marker: muted text after timestamp                                                            |
| E5          | Delete-for-me: message disappears completely from viewer's list                                        |
| E6          | Forward: max 5 chats per forward action                                                                |
| E7          | Forward: "Forwarded" marker at top of new message                                                      |
| **E10/E11** | **NO typing indicators** (explicitly cut from MVP)                                                     |
| E8          | Voice notes: `wavesurfer.js` for waveform rendering                                                    |
| E9          | Voice notes: max 5 minutes                                                                             |
| E12         | In-chat search: **local only** (over loaded messages)                                                  |
| E13         | Search UI: top bar with counter + prev/next arrows + 2s highlight                                      |
| E14         | Pinned messages: max 3 per chat, 4th pin is rejected (DB enforced)                                     |
| E15         | Sticker picker: Fase 2                                                                                 |
| E16         | Context menu: long-press (500ms) + right-click + hover 3-dot icon                                      |
| E17         | Reply preview: bar above composer + quoted bubble inside message                                       |
| E18         | Copy: text only (no metadata)                                                                          |
| E19         | Voice recording: `MediaRecorder` with `audio/webm;codecs=opus` (fallback `audio/mp4`)                  |
| E20         | Voice player: wavesurfer.js + `media_peaks integer[]` column                                           |
| E21         | Voice playback: exclusive (only 1 playing at a time)                                                   |

---

## 2. MIGRATION `0009_message_actions.sql`

```sql
-- 1. Voice note peaks (0-100 normalized, ~40 samples)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_peaks integer[] NULL;

-- 2. Forward tracking
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS forwarded_from_message_id uuid NULL
    REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_forwarded_from
  ON public.messages(forwarded_from_message_id)
  WHERE forwarded_from_message_id IS NOT NULL;

-- 3. Pin limit trigger (max 3 pinned messages per chat)
CREATE OR REPLACE FUNCTION check_pin_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
BEGIN
  -- Only check when transitioning from unpinned to pinned
  IF NEW.is_pinned_in_chat = true AND COALESCE(OLD.is_pinned_in_chat, false) = false THEN
    SELECT COUNT(*) INTO v_count
    FROM public.messages
    WHERE chat_id = NEW.chat_id
      AND is_pinned_in_chat = true
      AND deleted_at IS NULL
      AND id <> NEW.id;

    IF v_count >= 3 THEN
      RAISE EXCEPTION 'Cannot pin more than 3 messages in this chat';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_pin_limit
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  WHEN (NEW.is_pinned_in_chat = true AND COALESCE(OLD.is_pinned_in_chat, false) = false)
  EXECUTE FUNCTION check_pin_limit();

-- 4. Add message_reactions to Realtime publication (for live reaction updates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
END $$;

3. DEPENDENCIES
bash
pnpm add wavesurfer.js
wavesurfer.js is used only for rendering waveform bars during playback
in the voice player. Recording peaks is done via Web Audio API directly (see
voicePeaks.ts), then rendered by wavesurfer as a static waveform.

If wavesurfer.js bundle size becomes an issue (>50 KB gzipped), Fase 2 can
migrate to a lightweight SVG renderer using the pre-computed media_peaks
array (no need for the actual audio buffer).

4. FILE STRUCTURE
text
src/features/messages/
├── components/
│   ├── MessageContextMenu.tsx
│   ├── ReactionsPicker.tsx
│   ├── ReactionsDisplay.tsx
│   ├── EditMessageModal.tsx
│   ├── DeleteMessageModal.tsx
│   ├── ForwardModal.tsx
│   ├── InChatSearch.tsx
│   ├── PinnedMessagesBar.tsx
│   ├── ReplyPreview.tsx            (both bar above composer + bubble quote)
│   ├── VoiceRecorder.tsx
│   ├── VoicePlayer.tsx
│   └── SearchHighlight.tsx         (wrapper that fades a highlight on a message)
├── hooks/
│   ├── useMessageActions.ts        (edit, delete, forward, copy, pin)
│   ├── useReactions.ts
│   ├── useInChatSearch.ts
│   ├── usePinnedMessages.ts
│   ├── useVoiceRecorder.ts
│   ├── useVoicePlayback.ts         (exclusive playback store)
│   └── useSearchHighlight.ts
├── lib/
│   ├── voicePeaks.ts
│   ├── audioMimeType.ts
│   └── actionMatrix.ts             (which actions are available per message)
└── stores/
    └── audioStore.ts               (Zustand: which audio is currently playing)
Modified files:

MessageBubble.tsx (add context menu trigger + 3-dot hover button + reactions display + reply preview + forwarded marker + edited marker)

Composer.tsx (add reply bar above + voice recorder mic button)

MessageList.tsx (add PinnedMessagesBar mount point + search highlight scroll)

5. LIB: actionMatrix.ts
Determines which actions are available per message + user context.

ts
export type MessageAction =
  | 'reply'
  | 'react'
  | 'copy'
  | 'forward'
  | 'pin'
  | 'unpin'
  | 'edit'
  | 'delete_for_me'
  | 'delete_for_everyone';

export function getAvailableActions(
  message: Message,
  currentUserId: string
): MessageAction[] {
  // System messages: no actions
  if (message.type === 'system') return [];
  // Fully deleted
  if (message.deleted_for_everyone) return ['delete_for_me'];

  const isMine = message.sender_id === currentUserId;
  const within15min = Date.now() - new Date(message.created_at).getTime() < 15 * 60 * 1000;
  const within1h = Date.now() - new Date(message.created_at).getTime() < 60 * 60 * 1000;

  const actions: MessageAction[] = ['reply', 'react', 'forward', 'delete_for_me'];

  // Copy: only for text or file (has textual content worth copying)
  if (message.type === 'text' || message.type === 'file') {
    actions.push('copy');
  }

  // Pin / Unpin
  if (message.is_pinned_in_chat) {
    actions.push('unpin');
  } else {
    actions.push('pin');
  }

  // Edit: only mine, text or caption, within 15min
  if (
    isMine &&
    within15min &&
    (message.type === 'text' || message.type === 'image' || message.type === 'video')
  ) {
    actions.push('edit');
  }

  // Delete for everyone: only mine, within 1 hour
  if (isMine && within1h) {
    actions.push('delete_for_everyone');
  }

  return actions;
}
6. COMPONENT: MessageContextMenu
Trigger sources (all open the same menu at the message's position):

Long-press on mobile (500ms via useLongPress hook)

Right-click on desktop (onContextMenu)

Hover 3-dot icon on desktop (appears on hover, positioned top-right of bubble)

Layout:

Portal-rendered at fixed position (mobile: bottom sheet; desktop: floating near cursor)

Each row: icon + label, hover background

Destructive rows (delete_for_me / delete_for_everyone) at bottom, in text-destructive

Grouped with separators between logical sections (reply/copy/forward) → (react) → (pin/edit) → (delete)

Order:

Reply

React (opens <ReactionsPicker> submenu)

Copy (if applicable)

Forward

Pin / Unpin

Edit (if applicable)

─────────── (separator)

Delete for me

Delete for everyone (if applicable)

Behavior:

Actions call useMessageActions mutation hooks

Menu closes on any action or outside click / Escape

7. COMPONENT: ReactionsPicker
Triggered from context menu "React" action, OR from clicking the + pill in
the reactions display below a message.

Layout (popover):

8 fixed emojis in a row: 👍 ❤️ 😂 😮 😢 🙏 🎉 🔥

If user already reacted with one of these, that pill is highlighted

"+" button at the end opens the full emoji picker (frimousse, from #8a)

Toggle logic:

Click same emoji the user already reacted with → DELETE FROM message_reactions WHERE message_id = ? AND user_id = auth.uid()

Click different emoji → UPSERT INTO message_reactions (message_id, user_id, emoji)

Click "+" → opens picker → same toggle/replace logic with the chosen emoji

Optimistic updates: use TanStack Query onMutate to update
['messages', chatId] cache immediately, then invalidate on settle.

8. COMPONENT: ReactionsDisplay
Rendered below the message bubble (straddling the bottom edge, offset ~8px up
to feel attached).

Aggregation:

ts
// From message.reactions array
const groups = useMemo(() => {
  const map = new Map<string, { emoji: string; count: number; byMe: boolean; users: string[] }>();
  for (const r of message.reactions) {
    const existing = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, byMe: false, users: [] };
    existing.count++;
    existing.users.push(r.user_id);
    if (r.user_id === currentUserId) existing.byMe = true;
    map.set(r.emoji, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}, [message.reactions]);
Layout:

Row of pills, each: {emoji} {count}

Pills with byMe=true use bg-primary text-primary-foreground

Others use bg-muted

If no reactions, no display (no empty placeholder)

Click on a pill → toggles that emoji for current user (same as picker)

Long-press / right-click on a pill → tooltip with who reacted (Fase 2;
in MVP, single-line list under each pill for up to 5 users)

Realtime: reactions update via message_reactions in Realtime publication
(section 2). The subscription in useRealtimeMessages (from #8a) should
extend to listen for message_reactions INSERT/DELETE and update the cache.

9. COMPONENT: ReplyPreview
Two modes:

9.1 Bar above composer (drafting a reply)
Rendered in Composer when replyTo state is set:

text
┌─────────────────────────────────────┐
│ ▎ Replying to Alice                 │
│ ▎ Hola, ¿cómo estás?                │  [✕]
└─────────────────────────────────────┘
Left accent bar (4px, bg-primary)

Sender name in text-primary font-medium

Message preview: text content, or 📷 Photo, 🎥 Video, 📄 File, 🎤 Audio

Truncated to 2 lines

✕ clears replyTo

9.2 Quoted block inside message bubble
Rendered at the top of MessageBubble when message.reply_to_message_id
exists:

text
┌──────────────────────────────────┐
│ ┃ Alice                          │
│ ┃ Hola, ¿cómo estás?             │
│ ─────────────────────────────    │
│   Mi respuesta aquí              │
└──────────────────────────────────┘
Left accent bar (3px)

Sender name in accent color, text-xs

Content preview, text-xs, muted, 2-line truncation

Click → scroll to original message + apply 2s highlight

Composer state: replyTo: Message | null. Passed to useSendMessage
mutation which sets reply_to_message_id on INSERT.

10. COMPONENT: EditMessageModal
Trigger: context menu → Edit

Layout:

Centered modal

Title: "Edit message"

Textarea prefilled with message.content, same styling as composer

Character count below (for media captions, 500 max)

Buttons: "Cancel" / "Save"

Save:

ts
await supabase.from('messages')
  .update({ content: newContent, edited_at: new Date().toISOString() })
  .eq('id', message.id);
RLS already enforces the 15-minute window (Prompt #4b-1, two UPDATE
policies with mutually exclusive WITH CHECKs). If the update fails (race
condition), show toast "You can no longer edit this message."

After save: the message metadata row shows "Edited" after timestamp.

11. COMPONENT: DeleteMessageModal
Trigger: context menu → Delete for me / Delete for everyone

Layout by context:

11.1 Delete for me (always available)
Simple confirmation: "Delete this message for you? Others will still see it."

Buttons: "Cancel" / "Delete"

Action:

ts
await supabase.from('message_deletions').insert({
  message_id: message.id,
  user_id: currentUserId,
});
RLS from Prompt #4b-1 already allows this. The message disappears from the
viewer's list on next query (RLS filter on SELECT).

Optimistic: remove the message from ['messages', chatId] cache
immediately.

11.2 Delete for everyone (only if sender + within 1h)
Confirmation: "Delete this message for everyone? They'll see 'This message
was deleted' instead."

Buttons: "Cancel" / "Delete for everyone" (destructive)

Action:

ts
await supabase.from('messages').update({
  deleted_at: new Date().toISOString(),
  deleted_for_everyone: true,
}).eq('id', message.id);
RLS from Prompt #4b-1 (delete-for-everyone policy) enforces the 1-hour
window. If failed, toast "You can no longer delete this for everyone."

Optimistic: replace message content in cache with a "deleted"
placeholder.

11.3 Combined dialog (both options available)
When both are available, show a dialog with 3 buttons:

"Cancel"

"Delete for me" (secondary)

"Delete for everyone" (destructive)

12. COMPONENT: ForwardModal
Trigger: context menu → Forward

Layout:

Full-screen modal (mobile) / centered dialog (desktop)

Header: "Forward to..." + close button

Search input at top (filters chat list by name)

Chat list: checkboxes, multi-select

Footer: "Forward to N chats" button (disabled if 0 selected, hidden if > 5)

Max 5 selections: selecting 6th shows toast "You can select up to 5 chats"

Chat list source: reuses useChats() from Prompt #7 (active chats only,
no archived).

On confirm:

ts
for (const chatId of selectedChatIds) {
  await supabase.from('messages').insert({
    chat_id: chatId,
    sender_id: currentUserId,
    type: message.type,
    content: message.content,
    file_upload_id: message.file_upload_id, // Reference same file
    media_peaks: message.media_peaks,
    forwarded_from_message_id: message.id,
  });
}
Important: file_upload_id is copied — the storage file is reused (no
re-upload). The file_uploads row's uploader_id stays as the original
sender, which is fine (RLS on file_uploads doesn't allow transfer).

On success: toast "Forwarded to {N} chats" + close modal.

Forwarded marker: MessageBubble renders a small "Forwarded" label in
italic above the content when forwarded_from_message_id IS NOT NULL.

13. HOOK: useMessageActions
Single hook exposing mutations for all actions. Uses TanStack Query's
optimistic update pattern.

ts
export function useMessageActions(chatId: string) {
  const qc = useQueryClient();
  const userId = useAuth().user.id;

  const copyText = (content: string) => navigator.clipboard.writeText(content);

  const togglePin = useMutation({
    mutationFn: (messageId: string, pin: boolean) =>
      supabase.from('messages')
        .update({ is_pinned_in_chat: pin })
        .eq('id', messageId),
    onError: (err: any) => {
      if (err.message?.includes('Cannot pin more than 3')) {
        toast.error('You can only pin up to 3 messages. Unpin one first.');
      }
    },
  });

  const editMessage = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      supabase.from('messages').update({
        content,
        edited_at: new Date().toISOString(),
      }).eq('id', messageId),
  });

  const deleteForMe = useMutation({
    mutationFn: (messageId: string) =>
      supabase.from('message_deletions').insert({
        message_id: messageId,
        user_id: userId,
      }),
  });

  const deleteForEveryone = useMutation({
    mutationFn: (messageId: string) =>
      supabase.from('messages').update({
        deleted_at: new Date().toISOString(),
        deleted_for_everyone: true,
      }).eq('id', messageId),
  });

  const forwardToChats = useMutation({
    mutationFn: async ({ message, chatIds }: { message: Message; chatIds: string[] }) => {
      const inserts = chatIds.map(chat_id => ({
        chat_id,
        sender_id: userId,
        type: message.type,
        content: message.content,
        file_upload_id: message.file_upload_id,
        media_peaks: message.media_peaks,
        forwarded_from_message_id: message.id,
      }));
      const { error } = await supabase.from('messages').insert(inserts);
      if (error) throw error;
    },
  });

  return {
    copyText,
    togglePin,
    editMessage,
    deleteForMe,
    deleteForEveryone,
    forwardToChats,
  };
}
All mutations should use onMutate for optimistic updates and invalidate
['messages', chatId] + ['chats'] on settle.

14. COMPONENT: InChatSearch
Trigger: ChatOptionsMenu → "Search" (Prompt #9)

Layout: Replaces the chat header temporarily with a search bar:

text
[←] [🔍 Search in conversation...] [3 of 8] [↑] [↓] [✕]
Behavior:

On mount → auto-focus the input

Debounced 150ms filter over loaded messages only

Matches: message.content (case-insensitive substring)

Results ordered ascending by created_at

Counter shows currentIndex + 1 / total

↑/↓ navigate results → scroll to that message + apply .search-highlight

Highlight fades after 2s (CSS animation)

✕ closes search, clears highlights, restores header

Highlight CSS (added to globals.css utilities layer, Prompt #3):

css
@keyframes search-highlight-fade {
  0%   { background-color: color-mix(in oklab, var(--neon) 30%, transparent); }
  70%  { background-color: color-mix(in oklab, var(--neon) 30%, transparent); }
  100% { background-color: transparent; }
}
.search-highlight {
  animation: search-highlight-fade 2s ease-out forwards;
  border-radius: var(--radius-md);
}
Note on local-only limitation: if the chat has more messages than loaded
in cache, search misses old messages. Show a persistent small note under the
search bar: "Only searching loaded messages. Scroll up to load older ones."
(Fase 2: server-side search.)

15. COMPONENT: PinnedMessagesBar
Rendered: below ChatHeader when pinnedMessages.length > 0.

Collapsed state (default):

text
📌 Pinned message: Alice: "Meeting at 3pm..."                 [▼]
Expanded state (on click):

text
📌 3 pinned messages                                          [▲]
├─ Alice: "Meeting at 3pm..."                        [Go] [✕]
├─ Bob: "Don't forget the docs"                      [Go] [✕]
└─ You: "See you there"                              [Go] [✕]
Behavior:

[▼]/[▲] toggles expansion

[Go] on a row → scrolls to that message + 2s highlight

[✕] on a row → unpin that specific message

Bar updates reactively via usePinnedMessages(chatId) query key
['pinned', chatId], invalidated on any pin change

Data source:

ts
usePinnedMessages(chatId) → supabase.from('messages')
  .select('id, content, type, created_at, sender:profiles_visible(display_name)')
  .eq('chat_id', chatId)
  .eq('is_pinned_in_chat', true)
  .is('deleted_at', null)
  .order('created_at', { ascending: false });
16. HOOK: usePinnedMessages
Returns pinned messages for the chat. Subscribes to realtime updates on the
messages table (already covered by useRealtimeMessages from #8a, but this
hook exposes a filtered view).

TanStack Query key: ['pinned', chatId], invalidated on any messages UPDATE
where is_pinned_in_chat changes (handled by invalidation on the chat channel
from #8a).

17. COMPONENT: VoiceRecorder
Trigger: mic icon button in the composer (visible when text input is
empty).

Recording UI (replaces composer while recording):

text
┌──────────────────────────────────────────────────────┐
│  🔴 Recording... 0:14    ▁▃▅▇▅▃▂▁▃▅▇▅▃▂  [✕] [✓]    │
└──────────────────────────────────────────────────────┘
Live waveform from AnalyserNode (rolling window, last ~3s shown)

Timer via Intl.DateTimeFormat (mm:ss)

Slide-to-cancel gesture (mobile) OR ✕ button (desktop)

Stop button (✓) finalizes recording

Auto-stop at 5 min (toast "Maximum 5 minutes reached")

After stop — preview state:

text
┌──────────────────────────────────────────────────────┐
│  [▶] ▁▃▅▇▅▃▂▁▃▅▇▅▃▂ 0:14                [🗑] [Send]   │
└──────────────────────────────────────────────────────┘
Preview playback via <audio> element (simple, no wavesurfer)

Delete → discards recording

Send → uploads + sends message

Codec: MediaRecorder with audio/webm;codecs=opus (Chrome/Edge/FF).
Safari falls back to audio/mp4. Detection via MediaRecorder.isTypeSupported.

Peaks computation (before upload):

ts
const audioBuffer = await new AudioContext().decodeAudioData(arrayBuffer);
const peaks = computePeaks(audioBuffer, 40); // 40 integers 0-100
Upload (bucket chat-media, path {chat_id}/{upload_id}/voice-note.webm):

INSERT INTO file_uploads (status='pending', mime_type='audio/webm', ...)

Upload via uploadToStorage (from #8a)

UPDATE file_uploads SET status='completed'

INSERT INTO messages (type='audio', file_upload_id=?, media_peaks=?, content=NULL)

18. LIB: voicePeaks.ts
ts
export function computePeaks(audioBuffer: AudioBuffer, count = 40): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const samplesPerPeak = Math.floor(channelData.length / count);
  const peaks: number[] = [];

  for (let i = 0; i < count; i++) {
    let max = 0;
    const start = i * samplesPerPeak;
    const end = start + samplesPerPeak;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j] ?? 0);
      if (abs > max) max = abs;
    }
    peaks.push(Math.round(max * 100));
  }
  return peaks;
}
19. COMPONENT: VoicePlayer
Rendered inside the message bubble for type='audio' messages.

Layout:

text
┌────────────────────────────────────┐
│ [▶] ▁▃▅▇▅▃▂▁▃▅▇▅▃▂ 0:14           │
└────────────────────────────────────┘
Play/pause button (left)

Waveform bars (center) — rendered via wavesurfer.js OR a lightweight SVG
from media_peaks (see note below)

Duration text (right)

Progress overlay on bars (accent color) tracks playback position

wavesurfer.js usage:

Wavesurfer needs the audio URL. We fetch a signed URL on mount via
getSignedUrl(bucket, path) (from #8a's media.ts). Wavesurfer renders bars
from the actual decoded audio — but that's redundant since we already have
media_peaks.

Recommended approach for MVP (simpler + faster):

Render bars statically from media_peaks as an SVG (40 rects)

Use a native <audio> element (hidden) for playback

Track currentTime via timeupdate event → update a progress overlay on
the bars

Trade-off: wavesurfer.js provides smoother animations and audio effects,
but for a simple waveform + progress bar, static SVG + <audio> is 3 KB
instead of 50 KB. Use the static SVG approach in MVP. Keep wavesurfer.js
as a dependency only if needed for future features (region selection,
speed control — Fase 2).

If wavesurfer.js is preferred, initialize with:

ts
WaveSurfer.create({
  container: ref,
  waveColor: 'var(--muted-foreground)',
  progressColor: 'var(--primary)',
  barWidth: 2,
  barGap: 2,
  barRadius: 2,
  height: 28,
  url: signedUrl,
  interact: true,
});
Playback exclusivity (see section 20).

20. HOOK: useVoicePlayback
Zustand store ensuring exclusive playback across the app.

ts
// stores/audioStore.ts
interface AudioStore {
  currentId: string | null;
  currentAudio: HTMLAudioElement | null;
  play: (id: string, audio: HTMLAudioElement) => void;
  stop: () => void;
}

export const useAudioStore = create<AudioStore>((set, get) => ({
  currentId: null,
  currentAudio: null,
  play: (id, audio) => {
    const { currentAudio, currentId } = get();
    if (currentId === id) {
      // Toggle
      if (audio.paused) audio.play();
      else audio.pause();
      return;
    }
    // Stop previous
    currentAudio?.pause();
    if (currentAudio) currentAudio.currentTime = 0;
    // Play new
    audio.play();
    set({ currentId: id, currentAudio: audio });
  },
  stop: () => {
    get().currentAudio?.pause();
    if (get().currentAudio) get().currentAudio!.currentTime = 0;
    set({ currentId: null, currentAudio: null });
  },
}));
Usage in VoicePlayer:

onClick of play button → useAudioStore.getState().play(message.id, audioRef.current)

Subscribe to currentId to know if this player is active

On audio.ended → useAudioStore.getState().stop()

On unmount → if this is the current playing, stop()

21. MODIFIED: MessageBubble
Add to the existing MessageBubble from Prompt #8a:

3-dot hover button (desktop only): appears top-right of bubble on row
hover; click opens MessageContextMenu.

Long-press (mobile): 500ms via useLongPress → opens context menu.

Right-click (desktop): onContextMenu → opens context menu.

Reply preview (if reply_to_message_id): rendered above content inside
bubble (section 9.2).

Forwarded marker (if forwarded_from_message_id): small "Forwarded"
label in italic, muted, above reply preview.

"Edited" marker: in metadata row, after timestamp: "Edited" in
muted, text-[10px], only if edited_at IS NOT NULL.

Reactions display: rendered below bubble if message.reactions.length > 0.

Search highlight: wrapper class .search-highlight conditionally
applied when the message is the current search target.

22. MODIFIED: Composer
Add to the existing Composer from Prompt #8a:

Reply bar: rendered above the textarea when replyTo is set
(section 9.1). replyTo is lifted to the chat route state.

Mic button: replaces the send button when textarea is empty and no
files staged. Click → transitions to VoiceRecorder mode.

23. MODIFIED: MessageList
Add:

PinnedMessagesBar rendered above the scrollable message area (below
ChatHeader).

Search highlight handling: when scrollToMessage(id, { highlight: true })
is called, scroll to the message and apply .search-highlight class
temporarily (2s).

scrollToMessage utility exposed to parent routes for search and
pinned-message navigation.

24. MODIFIED: useRealtimeMessages (from #8a)
Extend the subscription to also listen for message_reactions INSERT and
DELETE:

ts
.on('postgres_changes',
    { event: '*', schema: 'public', table: 'message_reactions' },
    (payload) => {
      // Update reaction in messages cache
    })
25. WHAT NOT TO INCLUDE
❌ Typing indicators (explicitly cut)

❌ Sticker picker / catalog (Fase 2)

❌ Message info screen (Fase 2)

❌ Multi-message copy (Fase 2)

❌ Server-side search (Fase 2)

❌ Wavesurfer region selection / speed controls (Fase 2)

❌ @mention notifications (Fase 2)

❌ Message translation (Fase 2)

❌ Scheduled messages (Fase 2)

❌ Edit history viewer (Fase 2)

❌ Reactions tooltip with avatars (Fase 2)

26. HOW TO RESPOND
Respond in this exact order:

One-paragraph confirmation listing: migration 0009 (peaks +
forwarded + pin trigger + reactions realtime), 12 components, 7 hooks, 3
libs, action matrix, voice recording + playback with exclusive store.

Complete migration file supabase/migrations/0009_message_actions.sql.

Complete file tree of new/modified files.

Complete content of every file:

12 new components

7 hooks (useMessageActions, useReactions, useInChatSearch,
usePinnedMessages, useVoiceRecorder, useVoicePlayback,
useSearchHighlight)

3 libs (voicePeaks, audioMimeType, actionMatrix)

1 Zustand store (audioStore)

Modified MessageBubble, Composer, MessageList, useRealtimeMessages

Verification checklist:

Right-click a message → context menu opens

Long-press on mobile → context menu opens

Hover bubble → 3-dot icon appears → click opens menu

Reply → quoted block appears in composer + sent message shows quote

React with 👍 → pill appears below message → click again → removed

React with 😂 → replaces 👍 (not adds)

Two users react differently → 2 pills with count 1 each

Edit own text message → modal → save → "Edited" marker appears

Try edit after 15 min → no edit option in context menu (action matrix
filters it out)

Delete for me → message disappears from view immediately

Delete for everyone → "This message was deleted" for all users

Try delete-for-everyone after 1 hour → option missing (matrix + RLS)

Copy → text on clipboard

Forward to 3 chats → messages appear in all 3 with "Forwarded" label

Try forward to 6 chats → 6th selection blocked with toast

Pin 3 messages → 4th pin attempt → error toast

Pinned bar shows most recent pinned, click expands to list

Click "Go" on pinned → scrolls + 2s highlight

Search in chat → counter shows "1 of N", arrows navigate, 2s highlight

Search with > 50 messages loaded: warning "Only searching loaded messages"

Record voice note → live waveform → stop → preview → send → uploads

Voice note plays with waveform + progress

Play voice A, then voice B → A stops automatically

Voice note > 5 min → auto-stops at 5 min

A short list of pitfalls to warn the developer:

Why the pin limit is a DB trigger and not just app validation (race
conditions between two users pinning simultaneously)

Why file_upload_id is copied on forward (same storage object, no
re-upload; file_uploads row is shared)

Why reactions realtime requires message_reactions in the publication
(opt-in per table, already added to messages in #4b-2)

Why the static SVG approach is preferred over wavesurfer.js for MVP
(0 additional KB, media_peaks already has the data)

Why useAudioStore uses direct store access (.getState()) instead of
hooks in the event handler (avoids re-renders during playback)

Why useLongPress should be implemented with touchstart +
setTimeout(500) + cancel on touchmove > 10px (prevents accidental
triggers during scroll)

Why reply-to uses the reply_to:messages!reply_to_message_id join in
the query (single round-trip, no N+1 for quoted messages)

Why delete-for-everyone optimistically replaces the content with a
placeholder instead of removing the message (preserves scroll position +
other users still see it in their view)

Why the action matrix is a pure function exported from actionMatrix.ts
(testable, cacheable, no React state dependency)

Do not implement typing indicators, stickers, or message info. This
completes the chat feature set — no further chat prompts.
```
