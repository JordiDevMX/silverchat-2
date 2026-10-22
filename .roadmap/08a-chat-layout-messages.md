# SILVERCHAT — PROMPT #8a: CHAT LAYOUT, MESSAGE RENDERING & COMPOSER

You are a senior frontend engineer implementing the **chat view** — the
screen where users read and send messages. This is the most complex screen
in SilverChat.

This prompt (#8a) covers: header, message list, message rendering for all
types, scroll behaviors, composer, uploads, media preview, mentions.

**Not covered here (goes to #8b)**: reply action, reactions picker, edit,
delete, forward, copy, voice notes (recording), typing indicators, in-chat
search, pinned messages, sticker picker, context menu on messages.

All decisions are **final and locked**.

---

## 1. LOCKED DECISIONS

| #   | Decision                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------- |
| D1  | Initial scroll: no unread → bottom; with unread → unread marker; returning → restore position              |
| D2  | 50 messages initial load, 50 more per scroll-up (cursor `created_at < oldest`)                             |
| D3  | Message grouping: same sender + gap ≤ 5 min + same day                                                     |
| D4  | Videos: **click to play** (no autoplay)                                                                    |
| D5  | Emoji picker: **`frimousse`** (lazy-loaded, ~15 KB)                                                        |
| D6  | Attachments MVP: Photo/Video, Camera, File, Contact (**4 options**)                                        |
| D7  | 1 file per message                                                                                         |
| D8  | Preview modal with caption **before** sending                                                              |
| D9  | Link previews: **Fase 2** — MVP renders `<a>` only                                                         |
| D10 | @mentions: rendered + autocomplete, **no notifications** (Fase 2)                                          |
| D11 | Read receipts: mark when at bottom + 1s (initial) OR 500ms (new msg while at bottom); never if scrolled up |
| D12 | Optimistic UI: pending → sent → delivered → read (or failed)                                               |
| D13 | Presence via Realtime subscription to `profiles`                                                           |
| D14 | Bubbles: outgoing = accent + glow; incoming = card, no glow                                                |
| D15 | System messages: render exists, no triggers in MVP                                                         |
| D16 | Empty states per chat type (direct / group / self)                                                         |

Additional architectural decisions:

- **No virtualization in MVP.** Plain scroll container handles 50–500
  messages fine. `react-virtuoso` is Fase 2.
- **Upload flow**: image → client-side WebP compression → Supabase Storage;
  video → upload as-is + client-side thumbnail; file → upload as-is. All
  uploads create `file_uploads` row first (status `pending`), update to
  `completed` after.
- **Message send is non-transactional in MVP**: `INSERT INTO messages` first,
  then `file_upload_id` FK is already set (since upload completed before
  insert). No two-phase commit needed.
- **Auto-mark-read is via `mark_chat_as_read` RPC** (Prompt #4b-2). Client
  calls it on triggers from D11.

---

## 2. MIGRATION `0008_messages_enhancements.sql`

```sql
-- 1. Mentions column
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS mentions uuid[] NULL;

CREATE INDEX IF NOT EXISTS idx_messages_mentions
  ON public.messages USING GIN (mentions)
  WHERE mentions IS NOT NULL;

-- 2. Add profiles to Realtime for presence updates
-- (Idempotent: skip if already in publication)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

Note on realtime for profiles: RLS still applies to realtime payloads.
A user's presence changes (last_seen_at) will only be broadcast to clients
that can SELECT that profile row via profiles_visible. Since profiles
RLS is "own row only", other users will NOT receive realtime updates from
this table directly. Workaround: use a profiles_visible view-based
subscription or a dedicated presence mechanism.

Revised approach for MVP presence: Polling instead of Realtime. Client
polls profiles_visible every 30s for the other user in direct chats and
every 60s for members in group chats. Not real-time but acceptable.
Fase 2: dedicated presence service via Supabase Realtime Presence.

The migration above adds profiles to realtime publication but it's a
no-op for MVP (kept for Fase 2 enablement).

3. DEPENDENCIES
bash
pnpm add frimousse linkify-react
frimousse: emoji picker (~15 KB, lazily imported)

linkify-react: safe URL detection in text (wraps URLs in <a rel="noopener noreferrer" target="_blank">)

browser-image-compression already installed in Prompt #4a.

4. FILE STRUCTURE
text
src/routes/
└── _authenticated.chats.$chatId.tsx

src/features/messages/
├── components/
│   ├── ChatHeader.tsx
│   ├── MessageList.tsx
│   ├── MessageBubble.tsx
│   ├── DateSeparator.tsx
│   ├── UnreadMarker.tsx
│   ├── ScrollToBottomButton.tsx
│   ├── Composer.tsx
│   ├── AttachmentMenu.tsx
│   ├── MediaPreviewModal.tsx
│   ├── MediaLightbox.tsx
│   ├── MentionAutocomplete.tsx
│   ├── ReplyPreview.tsx           (render only — action in #8b)
│   ├── ReactionsDisplay.tsx       (render only — picker in #8b)
│   └── content/
│       ├── TextMessage.tsx
│       ├── ImageMessage.tsx
│       ├── VideoMessage.tsx
│       ├── AudioMessage.tsx
│       ├── FileMessage.tsx
│       ├── StickerMessage.tsx
│       ├── LocationMessage.tsx
│       ├── ContactMessage.tsx
│       └── SystemMessage.tsx
├── hooks/
│   ├── useMessages.ts
│   ├── useSendMessage.ts
│   ├── useMarkAsRead.ts
│   ├── useRealtimeMessages.ts
│   ├── useUploadProgress.ts
│   ├── useChatPresence.ts
│   └── useMentions.ts
├── lib/
│   ├── upload.ts
│   ├── media.ts
│   ├── groupMessages.ts
│   ├── videoThumbnail.ts
│   └── messageStatus.ts
└── utils/
    ├── formatMessageTime.ts
    └── linkifyText.tsx
5. ROUTE: src/routes/_authenticated.chats.$chatId.tsx
Search params:

scrollTo (optional): message ID to scroll to (used when navigating from
search results, from a chat list preview tap on a specific message)

Component:

tsx
function ChatPage() {
  const { chatId } = Route.useParams();
  const { scrollTo } = Route.useSearch();

  // 1. Fetch chat metadata + membership
  const { data: chat } = useChat(chatId);
  // 2. Fetch messages (paged)
  const messages = useMessages(chatId);
  // 3. Subscribe to realtime
  useRealtimeMessages(chatId);
  // 4. Auto-mark-read triggers
  useMarkAsRead(chatId);

  return (
    <div className="flex h-full flex-col">
      <ChatHeader chat={chat} />
      <MessageList chatId={chatId} scrollTo={scrollTo} />
      <Composer chatId={chatId} chat={chat} />
    </div>
  );
}
Guard conditions:

If chat doesn't exist → redirect to /chats

If user is not a member → redirect to /chats with toast

If chat.status === 'pending_request' and viewer is recipient → read-only
mode (composer hidden, banner "Accept this request to reply")

6. COMPONENT: ChatHeader
Layout (left to right):

Back button (<ChevronLeft>, mobile only, hidden on lg:)

Avatar (40×40), clickable → opens contact profile (Prompt #9)

Name + presence block:

Name: chat.displayName or contact.display_name, font-semibold text-base

Presence (below name, text-xs text-muted-foreground):

Direct chat: "Online" (green dot) / "Last seen X ago" / "Offline"

Group chat: "{N} members" (or "{N} members, {K} online" — Fase 2)

Community chat: "{community.name}"

Self chat: "Message yourself"

Actions (right side):

<Phone> → initiates voice call (Prompt #12)

<Video> → initiates video call (Prompt #12)

<MoreVertical> → opens ChatOptionsMenu (Prompt #9)

Behavior:

Header uses glass-surface class (Prompt #3) with border-b

Sticky at top of chat view

Click on avatar or name → opens <ContactProfileModal> (Prompt #9)

Presence computation (useChatPresence(chat)):

Poll profiles_visible for the other user (direct) or all members (group)
every 30s while the chat is open

presence_visible=false → always "Offline"

last_seen_at within 2 min → "Online"

Otherwise → Intl.RelativeTimeFormat with numeric: 'auto'

7. COMPONENT: MessageList
Container:

tsx
<div
  ref={scrollRef}
  className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1"
  onScroll={handleScroll}
>
  {/* messages */}
  {/* unread marker */}
  {/* scroll-to-bottom button positioned absolute bottom-right */}
</div>
Pagination:

Cursor-based: created_at < oldest_loaded (DESC order internally, reversed
for display)

useMessages(chatId) uses useInfiniteQuery from TanStack Query

On mount: fetch initial 50

On scroll to top (scrollTop < 100): trigger fetchNextPage()

Show <Loader2 className="animate-spin" /> at top while loading

When !hasNextPage: show "Beginning of conversation" (muted, centered)

Preserving scroll position on prepend:
When new page is loaded (messages prepended):

ts
const prevScrollHeight = scrollRef.current.scrollHeight;
const prevScrollTop = scrollRef.current.scrollTop;
// ... let React render new messages ...
requestAnimationFrame(() => {
  const delta = scrollRef.current.scrollHeight - prevScrollHeight;
  scrollRef.current.scrollTop = prevScrollTop + delta;
});
Initial scroll (D1):

ts
useEffect(() => {
  if (initialized.current) return;
  initialized.current = true;

  if (scrollTo) {
    scrollToMessage(scrollTo);
    return;
  }

  const firstUnreadId = messages.find(m => m.unreadForMe)?.id;
  if (firstUnreadId) {
    scrollToMessage(firstUnreadId, { align: 'center' });
  } else {
    scrollToBottom({ instant: true });
  }
}, []);
Auto-scroll on new message (received via Realtime):

ts
useEffect(() => {
  if (!lastMessage) return;
  const isNearBottom = scrollRef.current.scrollHeight
    - scrollRef.current.scrollTop
    - scrollRef.current.clientHeight < 100;

  if (isNearBottom || lastMessage.sender_id === currentUserId) {
    scrollToBottom({ smooth: true });
  } else {
    incrementNewMessageCount(); // shows badge on scroll-to-bottom button
  }
}, [lastMessage?.id]);
Rendering:

Group consecutive messages (see groupMessages.ts)

Insert <DateSeparator> between days

Insert <UnreadMarker> before the first unread message (only on initial
render, hidden after user scrolls past it)

ScrollToBottomButton (absolutely positioned, bottom-right, above composer):

Visible when scrolled up > 200px from bottom

Shows a badge with newMessageCount if > 0

On click → smooth scroll to bottom

8. COMPONENT: MessageBubble
Props:

ts
interface MessageBubbleProps {
  message: Message;
  previousMessage: Message | null;
  nextMessage: Message | null;
  isGroupedWithPrevious: boolean;
  isGroupedWithNext: boolean;
  isOwn: boolean;
  showAvatar: boolean; // false for direct chats, true for first-of-group in groups
  onMediaClick: (message: Message) => void;
}
Structure (outgoing, isOwn=true):

text
[spacer] [bubble] [avatar (hidden in direct, shown in groups)]
Structure (incoming, isOwn=false):

text
[avatar (in direct hidden, in groups shown)] [bubble] [spacer]
Bubble wrapper classes:

Outgoing: bg-primary text-primary-foreground shadow-[var(--shadow-glow)]

Incoming: bg-card text-card-foreground

Corner radii adjust based on grouping:

First of group: rounded-2xl but tail-side corner flat (top-left for
incoming, top-right for outgoing)

Middle of group: rounded except tail-side, which is flat

Last of group: rounded except tail-side, which is rounded

Solo: rounded-2xl

NO picos (tails) — pure rounded rectangle, just different corner
radii per position

Wait — decision in Prompt #3 said "no picos". Use pure rounded corners:

Outgoing: rounded-2xl always, but reduce bottom-right corner radius when
last-of-group is false → visually signals continuation via grouping.

Simplify: all bubbles are rounded-2xl. Grouping is communicated via
vertical spacing (1px between grouped, 8px between groups) and avatar
presence. No corner-radius logic needed. This is cleaner and matches the
design language.

Content (left side of bubble):

If reply_to_message_id exists → <ReplyPreview> (compact, top of bubble)

<MessageContent> (renders by type)

If mentions.length > 0 → mentions are already highlighted inline by
<TextMessage>; no additional UI

Metadata row (bottom-right of bubble, inside padding):

Time (HH:mm via Intl.DateTimeFormat, text-[10px] tabular-nums opacity-70)

Checkmarks (outgoing only, right after time):

sent → <Check className="size-3" />

delivered → <CheckCheck className="size-3" />

read → <CheckCheck className="size-3 text-blue-400" /> (in dark) /
text-blue-600 (in light) — use a dedicated CSS var
--message-read-color if needed

failed → <AlertCircle className="size-3 text-destructive" /> + tap
opens retry dialog

pending → <Loader2 className="size-3 animate-spin" />

deleted_for_everyone → bubble shows "This message was deleted" in italic,
no metadata row (no time, no checks)

Reactions display (if message.reactions.length > 0):
Below the bubble, a small pill row:

text
[👍 2] [❤️ 1] [+]
The + is only rendered if this is #8b (picker). For #8a, only render
aggregated reactions (no picker, no click handler).

9. COMPONENT: MessageContent and subtypes
Each <MessageContent> receives message and dispatches by type. Each
subtype handles its own layout.

9.1 TextMessage
<p className="whitespace-pre-wrap break-words text-sm leading-relaxed">

URLs auto-linked via linkify-react:

tsx
<Linkify options={{ target: '_blank', rel: 'noopener noreferrer' }}>
  {message.content}
</Linkify>
@username mentions rendered as <span className="text-primary font-medium"> (detected via message.mentions array — match @username patterns and verify against member list)

9.2 ImageMessage
<img> with src={signedUrl}, loading="lazy", class="rounded-xl max-w-[280px] max-h-[320px] object-cover" — will use message.media_width/media_height to reserve aspect ratio (avoid layout shift)

Click → opens <MediaLightbox> (fullscreen viewer)

Caption (message.content) below image inside the same bubble, if present

9.3 VideoMessage
Poster image from message.media_thumbnail_url (generated on upload)

Play button overlay (<Play> icon centered, glass background)

Click → opens <MediaLightbox> with <video controls autoplay>

No autoplay in the chat itself

Caption below

9.4 AudioMessage (audio file, NOT voice note — voice notes are #8b)
Simple:

text
[▶] [filename truncated] [0:42]
Play/pause toggle

Native <audio> element hidden behind custom UI

Progress bar (thin, accent color fill)

Right side: download link

9.5 FileMessage
text
[📄 FileText icon]  filename.pdf
                    2.4 MB
                    [download icon]
File icon by extension (PDF, DOCX, XLSX, ZIP, generic FileText)

Filename (truncated with ellipsis at 40 chars)

Size (formatted via Intl.NumberFormat + byte unit — use a helper
formatBytes)

Download button → calls getSignedUrl() (5-minute expiry) → opens in new
tab

9.6 StickerMessage
<img> with w-32 h-32 object-contain — no bubble background (stickers
render on the canvas directly)

No caption, no metadata row visible (time hidden for stickers)

9.7 LocationMessage
Static map thumbnail (MVP: use a generic map icon placeholder; Fase 2
for actual map render via OSM static maps)

Coordinates text: "12.3456, -78.9012"

Click → opens external Google Maps in new tab

Caption below

9.8 ContactMessage
Contact card style:

text
[Avatar circle]  {display_name}
                 @{username}
                 [Save contact button]
Button "Save contact" → for MVP, just opens the profile page
(/profile/:username)

9.9 SystemMessage
Centered, no bubble

<div className="text-xs text-muted-foreground italic text-center py-2">

10. COMPONENT: DateSeparator
Rendered between messages from different days.

Pill: <div className="mx-auto px-3 py-1 rounded-full bg-muted text-xs text-muted-foreground my-3">

Label logic:

ts
function getDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return t('today'); // "Today" / "Hoy"
  if (isYesterday) return t('yesterday'); // "Yesterday" / "Ayer"
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric', month: 'long', year: 'numeric'
  }).format(d);
}
11. COMPONENT: UnreadMarker
Rendered before the first message where message_receipts.read_at IS NULL
for the current user, only on initial render.

<div className="flex items-center gap-2 my-2 px-4">

Two horizontal lines + centered text

Label: "Unread messages" / "Mensajes sin leer"

Color: --primary

Disappears on first scroll past it (state unreadMarkerVisible = false
set once it leaves the viewport via IntersectionObserver)

12. COMPONENT: Composer
Container:

tsx
<div className="flex items-end gap-2 px-3 py-2 border-t bg-background">
  <IconButton icon={Plus} onClick={openAttachmentMenu} />
  <div className="flex-1 relative">
    <textarea ref={textareaRef} ... />
    <IconButton icon={Smile} onClick={openEmojiPicker} className="absolute right-2 bottom-2" />
  </div>
  <SendButton />
</div>
12.1 Textarea
Auto-resize: useEffect sets style.height = 'auto'; style.height = scrollHeight + 'px' capped at maxHeight = 120px (about 5 lines)

Placeholder: "Message..." / "Mensaje..."

Enter → send; Shift+Enter → newline (desktop); mobile uses
enterKeyHint="send"

Max length: not enforced (no limit — matches WhatsApp)

Draft persistence:

ts
const draftKey = `silverchat_draft_${chatId}`;
useEffect(() => {
  const saved = localStorage.getItem(draftKey);
  if (saved) setText(JSON.parse(saved).text);
}, [chatId]);
useEffect(() => {
  const timer = setTimeout(() => {
    if (text.trim()) {
      localStorage.setItem(draftKey, JSON.stringify({
        text, updatedAt: new Date().toISOString()
      }));
    } else {
      localStorage.removeItem(draftKey);
    }
  }, 500);
  return () => clearTimeout(timer);
}, [text]);
12.2 Send button
Icon: <Send> (or <ArrowUp> for a more modern look — WhatsApp uses a
circle with arrow)

Enabled only when text is non-empty OR a file is staged

On click → sendMessage()

On success → clear textarea + clear draft

12.3 Attachment menu (<AttachmentMenu>)
Opens as a bottom sheet (mobile) or popover (desktop). Items:

Icon	Label	Behavior
<ImageIcon>	Photo / Video	<input type="file" accept="image/*,video/*" multiple={false}>
<Camera>	Camera	<input type="file" accept="image/*,video/*" capture="environment">
<FileText>	File	<input type="file" accept="*/*">
<User>	Contact	Opens a modal to pick from contacts → sends a contact message
All file selections → open <MediaPreviewModal>.

12.4 Emoji picker
On Smile click → lazy-import frimousse:

tsx
const { EmojiPicker } = await import('frimousse');
Render in a popover above the composer

On emoji select → insert at caret position in the textarea

Close on outside click

12.5 Mentions (@)
Triggered when user types @ in a group or community_chat

Shows <MentionAutocomplete> dropdown above the composer

Filters chat members by username or display_name

On select → replace @partial with @username in text + add member's
user_id to a pendingMentions array

On send → includes mentions: pendingMentions in the INSERT

For direct chats: no @ autocomplete (no purpose)

13. COMPONENT: MediaPreviewModal
After file selection, before sending.

Layout:

Full-screen modal (mobile) / centered dialog (desktop)

Top: close button

Center: preview

Image: <img> scaled to fit

Video: <video controls> (paused at first frame)

File: icon + filename + size

Bottom:

Caption textarea (max 500 chars for image/video, 200 for files)

"Send" button

On send:

Compress image if applicable (browser-image-compression, max 2048px,
quality 0.82, WebP output)

Compute SHA-256 hash of compressed file (optional but recommended)

INSERT INTO file_uploads with status='pending'

uploadToStorage(bucket, path, file, onProgress)

UPDATE file_uploads SET status='completed'

INSERT INTO messages with type, content (caption), file_upload_id

For videos: also extract thumbnail BEFORE upload, upload separately to
same bucket with .thumb.jpg suffix, store URL in
messages.media_thumbnail_url

Progress UI:
While uploading, the modal stays open and shows:

Progress bar (from onProgress callback)

Cancel button → aborts uploadToStorage via AbortController

Upload path (bucket chat-media):

text
{chat_id}/{file_upload_id}/{filename}
14. COMPONENT: MediaLightbox
Fullscreen viewer for images and videos. Triggered from ImageMessage and
VideoMessage clicks.

Features:

Dark overlay (bg-black/90)

Close button (top-right)

Download button (top-right, before close) → signed URL → download

For images: <img> with max-w-full max-h-full object-contain

For videos: <video controls autoplay>

Swipe gestures for next/prev image NOT in MVP (Fase 2)

Escape key closes

Click outside media closes

15. HOOKS
15.1 useMessages(chatId)
TanStack Query useInfiniteQuery:

ts
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ['messages', chatId],
  queryFn: async ({ pageParam }) => {
    let query = supabase
      .from('messages')
      .select(`
        id, chat_id, sender_id, type, content, created_at, edited_at,
        deleted_at, deleted_for_everyone, reply_to_message_id, mentions,
        file_upload_id, location_data, contact_data,
        sender:profiles_visible!messages_sender_id_fkey (
          id, username, display_name, avatar_url
        ),
        file_upload:file_uploads (
          id, bucket, path, mime_type, size_bytes,
          width, height, duration_seconds, original_filename
        ),
        reply_to:messages!reply_to_message_id (
          id, content, type, deleted_for_everyone,
          sender:profiles_visible ( id, display_name )
        ),
        reactions:message_reactions ( emoji, user_id )
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (pageParam) query = query.lt('created_at', pageParam);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).reverse(); // ascending order for render
  },
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) =>
    lastPage.length === 50 ? lastPage[0].created_at : undefined,
});
Also: resolve signed URLs for file_upload.path via media.ts helper.
Cache signed URLs in React Query for 4 minutes (URL expires in 5).

15.2 useSendMessage(chatId)
ts
useMutation({
  mutationFn: async (input: SendMessageInput) => {
    // 1. Optimistic message with id = crypto.randomUUID()
    // 2. INSERT INTO messages
    const { data, error } = await supabase
      .from('messages')
      .insert({ chat_id: chatId, sender_id: userId, ...input })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  onMutate: async (input) => {
    // Cancel outgoing refetches
    // Snapshot previous state
    // Insert optimistic message into cache
    // Return context with previous state + optimistic id
  },
  onSuccess: (data, _input, ctx) => {
    // Replace optimistic entry with real one
  },
  onError: (_err, _input, ctx) => {
    // Mark optimistic message as failed (keep in cache with state=failed)
    // Show toast "Message failed to send"
  },
});
Cache updates: append to ['messages', chatId] (last page) and invalidate
['chats'] (to update preview).

15.3 useMarkAsRead(chatId)
Watches scroll position + document visibility + last message id.

ts
useEffect(() => {
  if (document.visibilityState !== 'visible') return;
  if (!isAtBottom()) return;

  const delay = initialRef.current ? 1000 : 500;
  const timer = setTimeout(() => {
    supabase.rpc('mark_chat_as_read', { p_chat_id: chatId });
    initialRef.current = false;
  }, delay);

  return () => clearTimeout(timer);
}, [lastMessageId, isAtBottom, visibilityState]);
isAtBottom() = scrollHeight - scrollTop - clientHeight < 100.

15.4 useRealtimeMessages(chatId)
ts
useEffect(() => {
  const channel = supabase
    .channel(`messages:${chatId}`)
    .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages',
          filter: `chat_id=eq.${chatId}` },
        (payload) => {
          // Append to cache (skip if it's our own optimistic msg echoed back)
          // Determine if user is at bottom → autoscroll; else → show badge
        })
    .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages',
          filter: `chat_id=eq.${chatId}` },
        (payload) => {
          // Update message in cache (edit, delete-for-everyone)
        })
    .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'message_receipts' },
        (payload) => {
          // Recompute read state for the last outgoing messages
        })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [chatId]);
Also: subscribe to chat_members for this chat (if user removed, redirect).

15.5 useUploadProgress()
Tracks in-flight uploads with a local Zustand store or React state.

Returns:

ts
{
  uploads: Map<uploadId, { fileName, progress, status, abort }>,
  startUpload(file, opts): Promise<FileUploadResult>,
  cancel(uploadId): void,
}
15.6 useChatPresence(chatId)
Polls profiles_visible every 30s (direct) or 60s (group).

15.7 useMentions(chatId)
For group chats: fetches the member list once, caches, and provides
autocomplete filtering by username or display_name.

16. LIB: upload.ts
ts
export async function uploadToStorage(
  bucket: string,
  path: string,
  file: File,
  opts: {
    onProgress?: (pct: number) => void;
    signal?: AbortSignal;
  } = {}
): Promise<{ path: string }> {
  const { data: session } = await supabase.auth.getSession();
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

  // Use XMLHttpRequest for upload progress (fetch doesn't support upload
  // progress in browsers as of 2025)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token}`);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress((e.loaded / e.total) * 100);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ path });
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.onabort = () => reject(new Error('Upload aborted'));
    opts.signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(file);
  });
}

export async function optimizeImage(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 2048,
    initialQuality: 0.82,
    fileType: 'image/webp',
    useWebWorker: true,
  });
  return new File([compressed], file.name.replace(/\.\w+$/, '.webp'), {
    type: 'image/webp',
  });
}
17. LIB: videoThumbnail.ts
ts
export async function extractVideoThumbnail(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.currentTime = 0.1;

    video.onloadeddata = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Thumbnail failed'));
          resolve(new File([blob], 'thumb.jpg', { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.75
      );
    };
    video.onerror = () => reject(new Error('Video load failed'));
  });
}
18. LIB: groupMessages.ts
ts
export function groupMessages(messages: Message[]): {
  date: string;
  groups: Array<{ messages: Message[] }>;
}[] {
  // 1. Split by day (date key = YYYY-MM-DD)
  // 2. Within each day, group consecutive messages by sender + gap <= 5 min
  // 3. Return array of { date, groups: [{ messages: [] }] }
}
Also exported: getBubblePosition(message, prev, next) → 'solo' | 'first' | 'middle' | 'last' for grouping styles (not currently used for corner radii
per Prompt #8a decision, but exposed for future use).

19. LIB: messageStatus.ts
ts
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export function computeMessageStatus(
  message: Message,
  receipts: MessageReceipt[],
  currentUserId: string
): MessageStatus {
  if (message.id.startsWith('temp-')) return 'pending';
  if (message.failed) return 'failed';
  if (message.sender_id !== currentUserId) return 'sent'; // doesn't matter for incoming

  const relevantReceipts = receipts.filter(
    r => r.message_id === message.id && r.user_id !== currentUserId
  );
  if (relevantReceipts.length === 0) return 'sent';
  if (relevantReceipts.every(r => r.read_at)) return 'read';
  if (relevantReceipts.every(r => r.delivered_at)) return 'delivered';
  return 'sent';
}
20. UTILS: formatMessageTime.ts
ts
export function formatMessageTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
21. UTILS: linkifyText.tsx
Wraps linkify-react with project-appropriate defaults:

tsx
export function LinkifiedText({ children }: { children: string }) {
  return (
    <Linkify options={{
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
      className: 'underline text-primary hover:text-primary/80',
    }}>
      {children}
    </Linkify>
  );
}
22. AUTO-MARK-READ TRIGGERS (D11)
Scenario	Trigger
Initial load, no unread	Never (nothing to mark)
Initial load, has unread, user scrolls to bottom	After 1s of staying at bottom
New message while at bottom (already read state)	After 500ms
New message while scrolled up	Never
Returning to chat after being on another tab	Treat as initial load
Document hidden → becomes visible, at bottom	Immediate (no delay)
Implementation lives in useMarkAsRead (section 15.3).

23. EMPTY STATES (D16)
Rendered when messages.length === 0.

Direct chat: centered card with <Avatar> of other user + "Say hi to
{name}! 👋" + hint "Messages are private to both of you."

Group chat: "This is the beginning of the group." + "Send a message to
get things started."

Self chat: "Message yourself" heading + "Notes, links, and ideas — just
for you."

No composer hidden — user can send immediately.

24. READ-ONLY MODE (pending_request recipient)
If chat.status === 'pending_request' AND the current user is the recipient
(the one who must accept/reject):

Show a banner above composer: "Accept this request to reply" + Accept/
Decline buttons

Composer is hidden (or disabled with overlay)

Accept calls accept_chat_request (from Prompt #7)

If current user is the sender of the pending request:

Composer is enabled (they can send more messages)

Banner shows: "Waiting for {recipient} to accept"

25. WHAT NOT TO INCLUDE
❌ Reply action (UI to reply) — #8b

❌ Reactions picker / add reaction — #8b

❌ Edit message — #8b

❌ Delete for me / for everyone — #8b

❌ Forward — #8b

❌ Copy — #8b

❌ Voice notes (recording) — #8b

❌ Typing indicators — #8b

❌ In-chat search — #8b

❌ Pin message — #8b

❌ Sticker picker (catalog) — #8b

❌ Message context menu — #8b

❌ Link OG previews — Fase 2

❌ GIF picker — Fase 2

❌ Location sharing UI (send current location) — Fase 2 (render only in MVP)

❌ Virtualization (react-virtuoso) — Fase 2

❌ Pinch-to-zoom in lightbox — Fase 2

❌ Multi-file selection — Fase 2 (single file per message)

❌ Message search — #8b

❌ Push notifications on new message — Fase 2

❌ Chat settings menu — #8b / #9

❌ Contact profile modal — #9

❌ Call UI — #12

26. HOW TO RESPOND
Respond in this exact order:

One-paragraph confirmation listing: migration 0008 (mentions + profiles
realtime publication), 13 components + 10 content subtypes, 7 hooks, 5 lib
helpers, upload flow, presence polling, realtime subscriptions, draft
persistence, auto-mark-read triggers.

Complete migration file supabase/migrations/0008_messages_enhancements.sql.

Complete file tree of new/modified files.

Complete content of every file:

Route: _authenticated.chats.$chatId.tsx

13 components (header, list, bubble, dates, unread marker,
scroll-to-bottom, composer, attachment menu, media preview, media
lightbox, mention autocomplete, reply preview, reactions display)

10 content subtypes (text, image, video, audio, file, sticker, location,
contact, system + the dispatcher)

7 hooks

5 lib helpers

2 utils

Verification checklist:

Open a chat with messages → scrolls to bottom

Open a chat with unread → scrolls to unread marker

Send a text message → appears immediately with pending, then ✓, then ✓✓
when delivered, then blue ✓✓ when read

Send an image → compressed to WebP <200 KB → upload progress shown →
thumbnail appears → click opens lightbox

Send a video → thumbnail extracted client-side → click opens lightbox
with video player

Send a file → renders as file card with download button

Type @ in a group → autocomplete appears → selecting inserts mention

Emoji picker → 15KB lazy-loaded, insert at caret

Attach a photo → preview modal opens → add caption → send

Scroll up → loads previous 50 messages → scroll position preserved

Scroll up → scroll-to-bottom button appears with count

Draft in chat A → navigate away → back to chat A → draft restored

Send message → draft cleared

Scroll up in chat with unread → does NOT mark as read

Scroll to bottom → after 1s, marks as read

Document hidden → new message arrives → no mark as read

Document visible at bottom → new message arrives → after 500ms marks as
read

Presence updates every 30s (open 2 browsers → one goes offline → other
updates within 30s)

pending_request recipient: banner shows, composer hidden

pending_request sender: can send, banner shows "waiting"

Empty state per chat type renders correctly

A short list of pitfalls to warn the developer:

Why XMLHttpRequest is used in uploadToStorage instead of fetch
(fetch lacks upload progress in browsers)

Why optimistic message IDs use temp- prefix (avoids collision with
real UUIDs, easy to identify)

Why realtime INSERT is skipped if payload.new.sender_id === userId && payload.new.id === optimisticId (double-render prevention)

Why presence uses polling instead of realtime (profiles RLS doesn't
broadcast to non-owners; realtime presence is Fase 2)

Why scroll position preservation on prepend uses requestAnimationFrame
(DOM must be committed before adjusting scrollTop)

Why read receipts have a 1s (initial) vs 500ms (subsequent) delay
(initial feels more deliberate, subsequent is snappier)

Why the mention autocomplete only triggers in group and
community_chat (no purpose in 1:1)

Why image compression is client-side before upload (matches Prompt #4a
storage policy; server never sees the original)

Why Linkify sets rel="noopener noreferrer nofollow" (prevents
window.opener exploits + SEO leaking)

Why unreadMarker disappears after first scroll past
(IntersectionObserver, not on state change — avoids flre-render churn)
```
