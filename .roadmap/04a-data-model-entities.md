# SILVERCHAT — PROMPT #4a: DATA MODEL (ENTITIES & RELATIONS)

You are a senior database architect designing the **complete Postgres schema**
for **SilverChat**, a privacy-first messaging web app. This prompt covers
**entities, fields, relationships, indexes, and structural triggers only**.

RLS policies, business-logic triggers, seed data, and RPC functions are
covered in the **next prompt (#4b)** — do NOT include them here.

The backend is **Supabase** (managed Postgres 15+). All schemas must be
compatible with Supabase's `auth.users` table and Storage subsystem.

All decisions below are **final and locked**. Do not propose alternatives
unless you identify a genuine blocker.

---

## 1. ARCHITECTURE PRINCIPLES

1. **Single `messages` table** for both chat and channel messages.
   `chat_id` and `channel_id` are mutually exclusive nullable FKs.
2. **Single `chats` table** for `direct`, `group`, `self`, and
   `community_chat` types, distinguished by a `type` enum.
3. **`message_receipts`** per-recipient (not a boolean on `messages`) — enables
   accurate read status in groups and future features (typing indicators per
   recipient, "delivered to 3 of 5", etc.).
4. **`direct_pair_key`** on `chats` — deterministic string that guarantees no
   duplicate 1:1 chats between the same two users. Format:
   `LEAST(uuidA::text, uuidB::text) || '::' || GREATEST(uuidA::text, uuidB::text)`.
   Self-chats use `self::<user_id>`.
5. **Denormalized `last_message_*`** on `chats` and `channels` — enables
   fast chat-list rendering without JOIN on `messages`.
6. **`file_uploads` table** separates file metadata from storage buckets —
   enables provider migration (Supabase → R2/B2/S3) without data loss,
   quotas per user, and query power ("all videos from user X").
7. **`app_config` table** enables dynamic runtime configuration (upload
   limits, feature flags) — no redeploy needed to change limits.
8. **`chat_requests` table** keeps historical log of request/rejection events
   (needed for the 7-day cooldown after rejection).
9. **NO `channel_messages` table** — merged into `messages`.
10. **NO `contacts` table** — "contact" is derived from having an `active`
    direct chat with someone.

---

## 2. ENUMS

Create these Postgres enums:

```sql
chat_type          → 'direct', 'group', 'self', 'community_chat'
chat_status        → 'active', 'pending_request', 'rejected'
chat_member_role   → 'admin', 'member'
message_type       → 'text', 'image', 'video', 'audio', 'file', 'sticker',
                     'location', 'contact', 'system'
call_type          → 'voice', 'video'
call_status        → 'ringing', 'answered', 'missed', 'declined', 'canceled', 'failed'
chat_request_status → 'pending', 'accepted', 'rejected'
report_status      → 'pending', 'reviewed', 'resolved', 'dismissed'
story_media_type   → 'image', 'video', 'text'
theme_preference   → 'light', 'dark', 'system'
accent_theme       → 'blue', 'purple', 'red', 'orange', 'yellow', 'green'
language_preference → 'en', 'es'
upload_status      → 'pending', 'uploading', 'completed', 'failed', 'aborted'
```

3. TABLES
   All tables use uuid primary keys with DEFAULT gen*random_uuid() unless
   noted. All timestamps are timestamptz. Naming: \_at for timestamps,
   \_id for FKs, is* / \_enabled for booleans.

3.1 profiles
1:1 with auth.users. RLS will enforce access rules in #4b.

text
id uuid PK FK auth.users(id) ON DELETE CASCADE
username text UNIQUE NOT NULL (regex: ^[a-z0-9_]{3,20}$)
display_name text NOT NULL
first_name text NULL
last_name text NULL
avatar_url text NULL
bio text NULL
social_links jsonb NOT NULL DEFAULT '{}'::jsonb
last_seen_at timestamptz NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

Indexes:
PK(id)
UNIQUE(username)
idx_profiles_created_at(created_at DESC)
3.2 user_settings
1:1 with profiles. All privacy and appearance settings.

text
user_id uuid PK FK profiles(id) ON DELETE CASCADE

-- Appearance
theme theme_preference NOT NULL DEFAULT 'system'
accent accent_theme NOT NULL DEFAULT 'blue'
language language_preference NOT NULL DEFAULT 'en'

-- Privacy
profile_photo_visibility text NOT NULL DEFAULT 'contacts'
-- 'everyone' | 'contacts' | 'contacts_except' | 'nobody'
profile_photo_exclusions uuid[] NOT NULL DEFAULT '{}'::uuid[]
presence_visible boolean NOT NULL DEFAULT true
story_visibility text NOT NULL DEFAULT 'contacts'
story_exclusions uuid[] NOT NULL DEFAULT '{}'::uuid[]
read_receipts_enabled boolean NOT NULL DEFAULT true

-- Notifications
notifications_enabled boolean NOT NULL DEFAULT true
notification_sound_enabled boolean NOT NULL DEFAULT true
notification_previews_enabled boolean NOT NULL DEFAULT true

updated_at timestamptz NOT NULL DEFAULT now()

Indexes:
PK(user_id)
3.3 devices
Multi-device tracking + Web Push subscriptions.

text
id uuid PK DEFAULT gen_random_uuid()
user_id uuid NOT NULL FK profiles(id) ON DELETE CASCADE
device_name text NOT NULL
device_type text NOT NULL DEFAULT 'web'
user_agent text NULL
last_active_at timestamptz NOT NULL DEFAULT now()
push_subscription jsonb NULL
created_at timestamptz NOT NULL DEFAULT now()

Indexes:
PK(id)
idx_devices_user(user_id)
idx_devices_user_last_active(user_id, last_active_at DESC)
3.4 chats
Unified table for direct, group, self, and community_chat.

text
id uuid PK DEFAULT gen_random_uuid()
type chat_type NOT NULL
status chat_status NOT NULL DEFAULT 'active'
name text NULL
description text NULL
avatar_url text NULL
community_id uuid NULL FK communities(id) ON DELETE CASCADE
direct_pair_key text UNIQUE NULL

-- Denormalized for fast list rendering
last_message_id uuid NULL FK messages(id) ON DELETE SET NULL
last_message_at timestamptz NULL
last_message_preview text NULL

-- Meta
created_by uuid NULL FK profiles(id) ON DELETE SET NULL
rejected_at timestamptz NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

Constraints:
CHECK (type != 'community_chat' OR community_id IS NOT NULL)
CHECK (type != 'direct' OR direct_pair_key IS NOT NULL)
CHECK (type != 'self' OR direct_pair_key IS NOT NULL)

Indexes:
PK(id)
UNIQUE(direct_pair_key)
idx_chats_last_message_at(last_message_at DESC NULLS LAST)
idx_chats_community(community_id) WHERE community_id IS NOT NULL
idx_chats_status(status)
3.5 chat_members
Junction with per-user state on each chat (pinned, favorited, etc.).

text
chat_id uuid FK chats(id) ON DELETE CASCADE
user_id uuid FK profiles(id) ON DELETE CASCADE
role chat_member_role NOT NULL DEFAULT 'member'
joined_at timestamptz NOT NULL DEFAULT now()
last_read_at timestamptz NOT NULL DEFAULT now()
pinned_at timestamptz NULL
favorited_at timestamptz NULL
archived_at timestamptz NULL
muted_until timestamptz NULL

PRIMARY KEY (chat_id, user_id)

Indexes:
PK(chat_id, user_id)
idx_chat_members_user(user_id, last_read_at DESC)
idx_chat_members_user_active(user_id, archived_at NULLS FIRST, last_read_at DESC)
3.6 messages
Unified for chat and channel messages. Exactly one of chat_id / channel_id
is set.

text
id uuid PK DEFAULT gen_random_uuid()
chat_id uuid NULL FK chats(id) ON DELETE CASCADE
channel_id uuid NULL FK channels(id) ON DELETE CASCADE
sender_id uuid NULL FK profiles(id) ON DELETE SET NULL
type message_type NOT NULL DEFAULT 'text'
content text NULL

-- Reply
reply_to_message_id uuid NULL FK messages(id) ON DELETE SET NULL

-- File reference
file_upload_id uuid NULL FK file_uploads(id) ON DELETE SET NULL

-- Location / Contact payloads
location_data jsonb NULL
contact_data jsonb NULL

-- Edit / Delete
edited_at timestamptz NULL
deleted_at timestamptz NULL
deleted_for_everyone boolean NOT NULL DEFAULT false

-- Flags
is_pinned_in_chat boolean NOT NULL DEFAULT false

created_at timestamptz NOT NULL DEFAULT now()

Constraints:
CHECK ((chat_id IS NULL) <> (channel_id IS NULL)) -- exactly one is set

Indexes:
PK(id)
idx_messages_chat(chat_id, created_at DESC) WHERE chat_id IS NOT NULL
idx_messages_channel(channel_id, created_at DESC) WHERE channel_id IS NOT NULL
idx_messages_sender(sender_id) WHERE sender_id IS NOT NULL
idx_messages_reply(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL
idx_messages_pinned(chat_id) WHERE is_pinned_in_chat = true
3.7 message_receipts
Per-recipient delivery / read state.

text
message_id uuid FK messages(id) ON DELETE CASCADE
user_id uuid FK profiles(id) ON DELETE CASCADE
delivered_at timestamptz NULL
read_at timestamptz NULL

PRIMARY KEY (message_id, user_id)

Indexes:
PK(message_id, user_id)
idx_receipts_user_unread(user_id) WHERE read_at IS NULL
3.8 message_reactions
text
message_id uuid FK messages(id) ON DELETE CASCADE
user_id uuid FK profiles(id) ON DELETE CASCADE
emoji text NOT NULL
created_at timestamptz NOT NULL DEFAULT now()

PRIMARY KEY (message_id, user_id)

Indexes:
PK(message_id, user_id)
idx_reactions_message(message_id)
3.9 message_deletions
Per-user "delete for me".

text
message_id uuid FK messages(id) ON DELETE CASCADE
user_id uuid FK profiles(id) ON DELETE CASCADE
deleted_at timestamptz NOT NULL DEFAULT now()

PRIMARY KEY (message_id, user_id)
3.10 chat_requests
Historical log of stranger-initiated requests. Used for the 7-day cooldown
after rejection. Historical rows are NOT deleted.

text
id uuid PK DEFAULT gen_random_uuid()
chat_id uuid NOT NULL FK chats(id) ON DELETE CASCADE
sender_id uuid NOT NULL FK profiles(id) ON DELETE CASCADE
recipient_id uuid NOT NULL FK profiles(id) ON DELETE CASCADE
status chat_request_status NOT NULL DEFAULT 'pending'
created_at timestamptz NOT NULL DEFAULT now()
responded_at timestamptz NULL

Indexes:
PK(id)
idx_chat_requests_chat(chat_id)
idx_chat_requests_recipient_pending(recipient_id) WHERE status = 'pending'
idx_chat_requests_cooldown(sender_id, recipient_id, responded_at DESC)
3.11 user_blocks
text
blocker_id uuid FK profiles(id) ON DELETE CASCADE
blocked_id uuid FK profiles(id) ON DELETE CASCADE
created_at timestamptz NOT NULL DEFAULT now()

PRIMARY KEY (blocker_id, blocked_id)

Indexes:
PK(blocker_id, blocked_id)
idx_user_blocks_blocked(blocked_id)
3.12 reports
text
id uuid PK DEFAULT gen_random_uuid()
reporter_id uuid NULL FK profiles(id) ON DELETE SET NULL
reported_user_id uuid NULL FK profiles(id) ON DELETE CASCADE
reported_chat_id uuid NULL FK chats(id) ON DELETE CASCADE
reported_message_id uuid NULL FK messages(id) ON DELETE CASCADE
reason text NOT NULL
description text NULL
status report_status NOT NULL DEFAULT 'pending'
created_at timestamptz NOT NULL DEFAULT now()
reviewed_at timestamptz NULL
reviewed_by uuid NULL FK profiles(id) ON DELETE SET NULL

Indexes:
PK(id)
idx_reports_pending(status) WHERE status = 'pending'
3.13 stories
24-hour ephemeral content. background_color only applies to text stories.

text
id uuid PK DEFAULT gen_random_uuid()
user_id uuid NOT NULL FK profiles(id) ON DELETE CASCADE
media_type story_media_type NOT NULL
file_upload_id uuid NULL FK file_uploads(id) ON DELETE SET NULL
text_content text NULL
background_color text NULL (hex or oklch, only for text stories)
caption text NULL
created_at timestamptz NOT NULL DEFAULT now()
expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')

Indexes:
PK(id)
idx_stories_user_created(user_id, created_at DESC)
idx_stories_expires(expires_at)
3.14 story_views
text
story_id uuid FK stories(id) ON DELETE CASCADE
viewer_id uuid FK profiles(id) ON DELETE CASCADE
viewed_at timestamptz NOT NULL DEFAULT now()

PRIMARY KEY (story_id, viewer_id)

Indexes:
PK(story_id, viewer_id)
idx_story_views_viewer(viewer_id, viewed_at DESC)
3.15 channels
Broadcast channels (Telegram-style). Only owner publishes.

text
id uuid PK DEFAULT gen_random_uuid()
name text NOT NULL
slug text UNIQUE NOT NULL
description text NULL
avatar_url text NULL
owner_id uuid NULL FK profiles(id) ON DELETE SET NULL
is_verified boolean NOT NULL DEFAULT false
follower_count integer NOT NULL DEFAULT 0

-- Denormalized for list rendering
last_message_at timestamptz NULL
last_message_preview text NULL

created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

Indexes:
PK(id)
UNIQUE(slug)
idx_channels_owner(owner_id)
idx_channels_last_message_at(last_message_at DESC NULLS LAST)
3.16 channel_followers
text
channel_id uuid FK channels(id) ON DELETE CASCADE
user_id uuid FK profiles(id) ON DELETE CASCADE
followed_at timestamptz NOT NULL DEFAULT now()
last_read_at timestamptz NOT NULL DEFAULT now()

PRIMARY KEY (channel_id, user_id)

Indexes:
PK(channel_id, user_id)
idx_channel_followers_user(user_id, last_read_at DESC)
3.17 communities
text
id uuid PK DEFAULT gen_random_uuid()
name text NOT NULL
description text NULL
avatar_url text NULL
owner_id uuid NULL FK profiles(id) ON DELETE SET NULL
member_count integer NOT NULL DEFAULT 0
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

Indexes:
PK(id)
idx_communities_owner(owner_id)
3.18 community_members
text
community_id uuid FK communities(id) ON DELETE CASCADE
user_id uuid FK profiles(id) ON DELETE CASCADE
role chat_member_role NOT NULL DEFAULT 'member'
joined_at timestamptz NOT NULL DEFAULT now()

PRIMARY KEY (community_id, user_id)

Indexes:
PK(community_id, user_id)
idx_community_members_user(user_id)
3.19 calls
chat_id is NOT NULL by design: calls can only happen inside an existing
chat, which prevents strangers from calling before the chat request is
accepted.

text
id uuid PK DEFAULT gen_random_uuid()
initiator_id uuid NOT NULL FK profiles(id) ON DELETE SET NULL
chat_id uuid NOT NULL FK chats(id) ON DELETE CASCADE
type call_type NOT NULL DEFAULT 'voice'
status call_status NOT NULL DEFAULT 'ringing'
livekit_room_name text UNIQUE NOT NULL
started_at timestamptz NOT NULL DEFAULT now()
answered_at timestamptz NULL
ended_at timestamptz NULL
duration_seconds integer NULL

Indexes:
PK(id)
UNIQUE(livekit_room_name)
idx_calls_initiator(initiator_id, started_at DESC)
idx_calls_chat(chat_id, started_at DESC)
idx_calls_ringing(status) WHERE status = 'ringing'
3.20 file_uploads
Metadata for every file uploaded to storage. Decoupled from bucket — the
bucket + path columns point to the current provider's location. Migrating
to R2/B2/S3 means updating the storage adapter, not this table.

text
id uuid PK DEFAULT gen_random_uuid()
uploader_id uuid NOT NULL FK profiles(id) ON DELETE CASCADE
bucket text NOT NULL
-- 'avatars' | 'chat-media' | 'story-media' | 'channel-media'
path text NOT NULL
original_filename text NOT NULL
mime_type text NOT NULL
size_bytes bigint NOT NULL
width integer NULL
height integer NULL
duration_seconds integer NULL
hash_sha256 text NULL
status upload_status NOT NULL DEFAULT 'pending'
created_at timestamptz NOT NULL DEFAULT now()
completed_at timestamptz NULL

Indexes:
PK(id)
UNIQUE(bucket, path)
idx_file_uploads_uploader(uploader_id, created_at DESC)
idx_file_uploads_pending(status) WHERE status = 'pending'
idx_file_uploads_hash(hash_sha256) WHERE hash_sha256 IS NOT NULL
3.21 app_config
Dynamic runtime configuration + feature flags. Values are JSONB to allow any
shape without migration.

text
key text PK
value jsonb NOT NULL
description text NULL
updated_at timestamptz NOT NULL DEFAULT now()

Indexes:
PK(key)
Seed rows (values are illustrative defaults — adjust in code at runtime):

key value
upload.max_bytes {"image": 10485760, "video": 104857600, "audio": 20971520, "document": 52428800}
upload.image_max_dimension {"value": 2048}
upload.image_quality {"value": 0.82}
upload.thumbnail_max_dimension {"value": 512}
upload.multipart_threshold {"value": 5242880}
feature.stories_enabled {"value": true}
feature.channels_enabled {"value": true}
feature.communities_enabled {"value": true}
feature.calls_enabled {"value": true} 4. STORAGE BUCKETS (Supabase Storage)
Bucket Public read Max file size (from app_config) MIME types
avatars ❌ Private image: 10 MB image/jpeg, image/png, image/webp
chat-media ❌ Private per-type from app_config image/, video/, audio/, application/pdf, application/
story-media ❌ Private image: 10 MB, video: 100 MB image/, video/
channel-media ❌ Private per-type from app_config image/, video/, application/pdf
Note: avatars is private because profile photo visibility is a user
setting (everyone, contacts, contacts_except, nobody). RLS on the
bucket will enforce this in #4b. Signed URLs are used for retrieval.

Hard limits enforced by Supabase (not our config): individual file max =
50 MB per request when using the default upload endpoint. Files > 50 MB
REQUIRE multipart upload (see section 6.3).

5. STRUCTURAL TRIGGERS (basic — business logic triggers go in #4b)
   5.1 set_updated_at()
   Generic trigger function:

sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;

$$
LANGUAGE plpgsql;
Applied to: profiles, user_settings, chats, channels, communities,
app_config.

5.2 handle_new_user()
Trigger AFTER INSERT ON auth.users:

sql
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger AS
$$

BEGIN
INSERT INTO public.profiles (id, username, display*name)
VALUES (
NEW.id,
'user*' || substr(NEW.id::text, 1, 8),
COALESCE(NEW.raw_user_meta_data->>'display_name', 'New User')
);
INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
RETURN NEW;
END;

$$
LANGUAGE plpgsql SECURITY DEFINER;
The username is a placeholder; the user will be forced to pick a real one
in the onboarding flow (Prompt #5).

6. STORAGE ARCHITECTURE (DESIGN NOTES — no implementation here)
These are architectural decisions that must be documented in code
comments in the codebase. They do not require additional tables or
functions in this prompt, but future prompts must respect them.

6.1 Abstraction seam for future provider migration
Even though MVP uploads go directly to Supabase Storage via the client SDK,
all upload calls must be wrapped in a single client-side module
(src/lib/storage.ts) exposing:

ts
uploadFile(bucket, file, opts): Promise<FileUploadResult>
getSignedUrl(bucket, path, expiresIn): Promise<string>
deleteFile(bucket, path): Promise<void>
Nothing else in the codebase calls supabase.storage directly. This makes
future migration to Cloudflare R2 / Backblaze B2 / S3 a change confined to
this module (and possibly one Edge Function).

6.2 Client-side image optimization (mandatory)
All images (avatars + chat/story/channel media) are converted to WebP on
the client before upload using:

Library: browser-image-compression (worker-based, no UI blocking)

Max dimension: from app_config.upload.image_max_dimension (default 2048px)

Quality: from app_config.upload.image_quality (default 0.82)

Output: image/webp

Original files are NEVER uploaded. The DB always sees the optimized WebP.

6.3 Multipart upload from day 1
Files exceeding app_config.upload.multipart_threshold (default 5 MB) MUST
use Supabase's multipart upload protocol:

text
POST /storage/v1/object/{bucket}/{path}   → create
PUT  /storage/v1/object/{bucket}/{path}?uploadId=...&partNumber=N  → parts
POST /storage/v1/object/{bucket}/{path}?uploadId=...  → complete
The @supabase/storage-js SDK handles this transparently via its .upload()
method when the file is large enough. The file_uploads row is created with
status='pending' before upload, then updated to completed after.

6.4 Video strategy for MVP
No server-side transcoding on MVP (costly, needs dedicated infra).

Client-side thumbnail extracted from the video's first frame using
<canvas> + HTMLVideoElement, uploaded alongside.

Playback via native <video> tag in the UI.

Fase 2 migration: post-process with Cloudflare Stream or AWS
MediaConvert (documented as future work, not implemented here).

6.5 Metadata is always separated from the bucket
Every uploaded file MUST have a corresponding file_uploads row before
the messages / stories / etc. row references it. This enables:

Per-user storage quotas (SUM(size_bytes) GROUP BY uploader_id)

Provider migration without data loss

Retention policies ("delete all file_uploads created > 90 days ago and not
referenced by any message")

Analytics ("total video bytes uploaded this week")

7. OUT OF SCOPE FOR THIS PROMPT (goes to #4b)
Do NOT include:

RLS policies (per-table CREATE POLICY statements)

Business-logic triggers (auto-receipts, last_message_* updates,
member_count increments, follower_count increments, cooldown
enforcement)

Storage bucket RLS policies

RPC functions (mark_chat_as_read, accept_chat_request, etc.)

Realtime publication settings

Cron jobs (story expiry, file_uploads cleanup, etc.)

Seed data beyond app_config defaults

Auth hooks beyond handle_new_user()

8. HOW TO RESPOND
Respond in this exact order:

One-paragraph confirmation that you understood: unified chats,
unified messages, no channel_messages, file_uploads, app_config,
chat_requests as history only, calls.chat_id NOT NULL.

Complete SQL migration file supabase/migrations/0001_initial_schema.sql
containing:

CREATE EXTENSION IF NOT EXISTS pgcrypto; (for gen_random_uuid)

All enum definitions (CREATE TYPE ... AS ENUM)

All tables in dependency order (profiles before chats before
messages, etc.)

All constraints and CHECKs

All indexes

The two structural triggers (set_updated_at, handle_new_user)

Seed inserts for app_config defaults

A comment header block documenting: the CHECK constraint on messages
for the chat_id XOR channel_id rule, and the deterministic format
of direct_pair_key

A brief note on each of these implementation details to guide future
prompts:

How direct_pair_key must be computed client-side before insert

How chat_requests + chats.status='rejected' + chats.rejected_at
interact to enforce the 7-day cooldown

Why chat_id and channel_id on messages are mutually exclusive
and what breaks if a future migration adds a third scope

How file_uploads must be created before the referencing
messages/stories row (transaction ordering)

A verification checklist the developer can run after applying the
migration:

supabase db reset applies without errors

Query information_schema.tables shows all 21 tables

Query information_schema.table_constraints shows all CHECKs

Trigger handle_new_user fires when a test user is created via Supabase
Auth

SELECT * FROM app_config; returns the 9 seed rows

Attempting to insert a messages row with both chat_id and
channel_id set fails with the CHECK constraint

Attempting to insert two chats with the same direct_pair_key fails
with UNIQUE violation

A short list of pitfalls to warn the developer:

Why direct_pair_key must be deterministic (order of UUIDs doesn't
matter)

Why calls.chat_id is NOT NULL and what it implies for the chat
request flow

Why file_uploads has its own status field separate from the
referencing row

Why the handle_new_user trigger must run as SECURITY DEFINER

Why chat_requests rows must never be deleted (cooldown history)

Do not create RLS policies, business triggers, or RPC functions.
$$
