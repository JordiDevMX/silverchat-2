# SILVERCHAT — PROMPT #4b-2: BUSINESS LOGIC, RPCs, REALTIME & CRON

You are a senior database engineer completing the SilverChat backend. This
prompt implements the **business logic layer** that sits on top of the schema
(#4a) and RLS policies (#4b-1):

1. **Policy amendments** fixing gaps discovered during RPC design
2. **Business-logic triggers** (denormalized counters, auto-receipts, preview
   updates, group admin promotion, orphaned chat cleanup)
3. **13 RPCs** (`SECURITY DEFINER`) for atomic multi-table operations
4. **Realtime publication** (which tables emit change events)
5. **pg_cron jobs** for housekeeping

All decisions are **final and locked**. Do not propose alternatives.

---

## 1. CONTEXT & LOCKED DECISIONS

### 1.1 From prior prompts

- Schema: 21 tables, 14 enums (see #4a)
- RLS: 62+ policies, 13 helper functions (see #4b-1)
- Reserved RPC names (from #4b-1, section 6)

### 1.2 New decisions confirmed for this prompt

| Decision                               | Value                                                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Pending request message visibility** | Recipient can READ via `chat_requests` JOIN, cannot INSERT until accepted                                        |
| **Pending request message sending**    | Only the creator can send (multiple messages allowed while pending)                                              |
| **`channels.last_message_id`**         | Added via `ALTER TABLE` — needed for delete-for-everyone preview updates                                         |
| **Leave direct/self chat**             | Blocked — only `group` and `community_chat` allow `chat_members` DELETE. Direct/self use `archived_at`           |
| **Last admin leaves group**            | Trigger auto-promotes oldest remaining member to admin                                                           |
| **Last member leaves group**           | Trigger deletes the chat (cascade)                                                                               |
| **Deleted message content**            | Kept in DB (hidden via RLS); GDPR purge is Fase 2                                                                |
| **Owner deletes account**              | Community/channel becomes orphaned (`owner_id = NULL`); Fase 2 will add ownership transfer                       |
| **Realtime publication**               | `messages`, `chat_members`, `calls`, `message_receipts`, `stories`                                               |
| **Presence**                           | `profiles.last_seen_at` heartbeat every 60s (client-side); no Supabase Presence                                  |
| **Storage orphan files**               | Cron removes DB rows; actual Storage files accumulate on free tier (~1GB limit); Edge Function cleanup is Fase 2 |
| **pg_cron**                            | Enabled via `CREATE EXTENSION IF NOT EXISTS pg_cron;`                                                            |

---

## 2. POLICY AMENDMENTS (fix gaps from #4b-1)

The following policies from #4b-1 need to be **dropped and recreated** with
additional conditions.

### 2.1 `messages` SELECT — allow pending-request recipient to read

```sql
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated
  USING (
    (
      chat_id IS NOT NULL
      AND (
        is_chat_member(chat_id, auth.uid())
        OR EXISTS (
          SELECT 1 FROM chat_requests cr
          WHERE cr.chat_id = messages.chat_id
            AND cr.recipient_id = auth.uid()
            AND cr.status = 'pending'
        )
      )
      AND NOT is_message_deleted_for_user(id, auth.uid())
    )
    OR
    (
      channel_id IS NOT NULL AND (
        is_channel_follower(channel_id, auth.uid())
        OR is_channel_owner(channel_id, auth.uid())
      )
    )
  );

  2.2 messages INSERT — allow pending-request sender to write
sql
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (
        chat_id IS NOT NULL
        AND is_chat_member(chat_id, auth.uid())
        AND (
          is_chat_active(chat_id)
          OR EXISTS (
            SELECT 1 FROM chat_requests cr
            WHERE cr.chat_id = messages.chat_id
              AND cr.sender_id = auth.uid()
              AND cr.status = 'pending'
          )
        )
      )
      OR
      (channel_id IS NOT NULL AND is_channel_owner(channel_id, auth.uid()))
    )
  );
2.3 chat_members DELETE — block direct/self chats
sql
DROP POLICY IF EXISTS "chat_members_delete_own" ON public.chat_members;
CREATE POLICY "chat_members_delete_own" ON public.chat_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chats
      WHERE id = chat_members.chat_id
        AND type IN ('group', 'community_chat')
    )
  );
2.4 channels — add last_message_id column
sql
ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS last_message_id uuid NULL
    REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_channels_last_message
  ON public.channels(last_message_id)
  WHERE last_message_id IS NOT NULL;
3. BUSINESS-LOGIC TRIGGERS
3.1 Helper: compute_message_preview(message) RETURNS text
Generates the chat-list preview text. Must handle every message_type.

sql
CREATE OR REPLACE FUNCTION compute_message_preview(m public.messages)
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT CASE
    WHEN m.deleted_for_everyone THEN 'This message was deleted'
    WHEN m.type = 'text' THEN LEFT(COALESCE(m.content, ''), 100)
    WHEN m.type = 'image' THEN
      '📷 Photo' || CASE WHEN m.content IS NOT NULL
        THEN ' — ' || LEFT(m.content, 80) ELSE '' END
    WHEN m.type = 'video' THEN
      '🎥 Video' || CASE WHEN m.content IS NOT NULL
        THEN ' — ' || LEFT(m.content, 80) ELSE '' END
    WHEN m.type = 'audio' THEN '🎤 Audio'
    WHEN m.type = 'file' THEN
      '📄 ' || COALESCE(
        (SELECT original_filename FROM public.file_uploads
         WHERE id = m.file_upload_id), 'File')
    WHEN m.type = 'sticker' THEN '🎨 Sticker'
    WHEN m.type = 'location' THEN '📍 Location'
    WHEN m.type = 'contact' THEN '👤 Contact'
    WHEN m.type = 'system' THEN COALESCE(m.content, '')
    ELSE COALESCE(m.content, '')
  END;
$$;
3.2 Trigger: handle_new_message (AFTER INSERT on messages)
Responsibilities:

Auto-create message_receipts for every chat_member (except sender)

Update chats.last_message_* (if chat_id IS NOT NULL)

Update channels.last_message_* + last_message_id (if channel_id)

sql
CREATE OR REPLACE FUNCTION handle_new_message()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Auto-receipts for chat members
  IF NEW.chat_id IS NOT NULL THEN
    INSERT INTO public.message_receipts (message_id, user_id, delivered_at)
    SELECT NEW.id, cm.user_id, now()
    FROM public.chat_members cm
    WHERE cm.chat_id = NEW.chat_id
      AND (NEW.sender_id IS NULL OR cm.user_id <> NEW.sender_id)
    ON CONFLICT (message_id, user_id) DO NOTHING;
  END IF;

  -- 2. Update chat denormalized fields
  IF NEW.chat_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
    UPDATE public.chats
    SET last_message_id = NEW.id,
        last_message_at = NEW.created_at,
        last_message_preview = compute_message_preview(NEW)
    WHERE id = NEW.chat_id;
  END IF;

  -- 3. Update channel denormalized fields
  IF NEW.channel_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
    UPDATE public.channels
    SET last_message_id = NEW.id,
        last_message_at = NEW.created_at,
        last_message_preview = compute_message_preview(NEW)
    WHERE id = NEW.channel_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_after_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION handle_new_message();
3.3 Trigger: handle_message_update (AFTER UPDATE on messages)
Updates preview when a message is deleted-for-everyone and it was the last
message in a chat or channel.

sql
CREATE OR REPLACE FUNCTION handle_message_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Preview update on delete-for-everyone
  IF NEW.deleted_for_everyone = true AND OLD.deleted_for_everyone = false THEN
    IF NEW.chat_id IS NOT NULL THEN
      UPDATE public.chats
      SET last_message_preview = 'This message was deleted'
      WHERE id = NEW.chat_id AND last_message_id = NEW.id;
    ELSIF NEW.channel_id IS NOT NULL THEN
      UPDATE public.channels
      SET last_message_preview = 'This message was deleted'
      WHERE id = NEW.channel_id AND last_message_id = NEW.id;
    END IF;
  END IF;

  -- Preview update on edit (only if edited message was the last)
  IF NEW.edited_at IS NOT NULL AND OLD.edited_at IS DISTINCT FROM NEW.edited_at THEN
    IF NEW.chat_id IS NOT NULL THEN
      UPDATE public.chats
      SET last_message_preview = compute_message_preview(NEW)
      WHERE id = NEW.chat_id AND last_message_id = NEW.id;
    ELSIF NEW.channel_id IS NOT NULL THEN
      UPDATE public.channels
      SET last_message_preview = compute_message_preview(NEW)
      WHERE id = NEW.channel_id AND last_message_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_after_update
  AFTER UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION handle_message_update();
3.4 Trigger: handle_community_member_change (INSERT + DELETE)
sql
-- INSERT: increment counter + auto-join all community_chats
CREATE OR REPLACE FUNCTION handle_community_member_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.communities
  SET member_count = member_count + 1
  WHERE id = NEW.community_id;

  -- Auto-join all chats of this community
  INSERT INTO public.chat_members (chat_id, user_id)
  SELECT c.id, NEW.user_id
  FROM public.chats c
  WHERE c.community_id = NEW.community_id
  ON CONFLICT (chat_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER community_members_after_insert
  AFTER INSERT ON public.community_members
  FOR EACH ROW EXECUTE FUNCTION handle_community_member_insert();

-- DELETE: decrement counter + leave all community_chats
CREATE OR REPLACE FUNCTION handle_community_member_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.communities
  SET member_count = GREATEST(member_count - 1, 0)
  WHERE id = OLD.community_id;

  DELETE FROM public.chat_members
  WHERE user_id = OLD.user_id
    AND chat_id IN (
      SELECT id FROM public.chats WHERE community_id = OLD.community_id
    );

  RETURN OLD;
END;
$$;

CREATE TRIGGER community_members_after_delete
  AFTER DELETE ON public.community_members
  FOR EACH ROW EXECUTE FUNCTION handle_community_member_delete();
3.5 Trigger: handle_channel_follower_change (INSERT + DELETE)
sql
CREATE OR REPLACE FUNCTION handle_channel_follower_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.channels
  SET follower_count = follower_count + 1
  WHERE id = NEW.channel_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER channel_followers_after_insert
  AFTER INSERT ON public.channel_followers
  FOR EACH ROW EXECUTE FUNCTION handle_channel_follower_insert();

CREATE OR REPLACE FUNCTION handle_channel_follower_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.channels
  SET follower_count = GREATEST(follower_count - 1, 0)
  WHERE id = OLD.channel_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER channel_followers_after_delete
  AFTER DELETE ON public.channel_followers
  FOR EACH ROW EXECUTE FUNCTION handle_channel_follower_delete();
3.6 Trigger: handle_chat_member_delete (AFTER DELETE on chat_members)
Two responsibilities:

If last member leaves a group → delete the chat (cascade).

If last admin leaves but members remain → promote oldest member to admin.

sql
CREATE OR REPLACE FUNCTION handle_chat_member_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_members int;
  remaining_admins int;
  oldest_member uuid;
BEGIN
  -- Only applies to group / community_chat
  IF EXISTS (
    SELECT 1 FROM public.chats
    WHERE id = OLD.chat_id AND type IN ('group', 'community_chat')
  ) THEN
    SELECT COUNT(*) INTO remaining_members
    FROM public.chat_members WHERE chat_id = OLD.chat_id;

    -- Last member leaves → cascade delete chat
    IF remaining_members = 0 THEN
      DELETE FROM public.chats WHERE id = OLD.chat_id;
      RETURN OLD;
    END IF;

    -- Last admin leaves → promote oldest member
    IF OLD.role = 'admin' THEN
      SELECT COUNT(*) INTO remaining_admins
      FROM public.chat_members
      WHERE chat_id = OLD.chat_id AND role = 'admin';

      IF remaining_admins = 0 THEN
        SELECT user_id INTO oldest_member
        FROM public.chat_members
        WHERE chat_id = OLD.chat_id
        ORDER BY joined_at ASC
        LIMIT 1;

        IF oldest_member IS NOT NULL THEN
          UPDATE public.chat_members
          SET role = 'admin'
          WHERE chat_id = OLD.chat_id AND user_id = oldest_member;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER chat_members_after_delete
  AFTER DELETE ON public.chat_members
  FOR EACH ROW EXECUTE FUNCTION handle_chat_member_delete();
4. RPCs (SECURITY DEFINER)
All RPCs:

LANGUAGE plpgsql SECURITY DEFINER SET search_path = public

GRANT EXECUTE ON FUNCTION ... TO authenticated;

Validate all inputs and permissions inside the function body

Raise exceptions with clear messages for common failure cases

4.1 create_direct_chat_request(p_target_user_id uuid, p_initial_content text) RETURNS uuid
Creates (or reuses) a direct chat and starts a request. Returns the chat id.

Logic:

Reject if p_target_user_id = auth.uid() (use a separate self-chat RPC or
create self directly — see 4.2)

Reject if either user blocked the other (is_blocked_either_way)

Compute direct_pair_key deterministically

If an active chat exists for this pair → return its id (no-op)

If a pending_request chat exists → return its id (no-op)

If a rejected chat exists:

If rejected_at > now() - interval '7 days' → RAISE EXCEPTION 'Cooldown active: try again in X days'

Else: reset status='pending_request', rejected_at=NULL, insert new
chat_requests row, return id

Else (no existing chat):

Insert chats row with type='direct', status='pending_request',
direct_pair_key, created_by=auth.uid()

Insert chat_members for creator only

Insert chat_requests row (status='pending')

Insert initial message (via direct INSERT — SECURITY DEFINER bypasses RLS
since we've already validated)

Return chat id

4.2 create_self_chat() RETURNS uuid
Creates (or reuses) the self-chat for the current user.

type='self', status='active', direct_pair_key='self::' || auth.uid()::text

Insert chat_members for self.

4.3 create_group_chat(p_name text, p_member_ids uuid[]) RETURNS uuid
Validate p_member_ids has 1–255 entries (excluding creator)

Reject if any member has blocked the creator (skip them silently? — DECISION: reject with clear error, so the UI can inform the user)

Create chats row (type='group', status='active', name, created_by)

Insert chat_members for creator (role='admin') and all members (role='member')

Return chat id

4.4 add_chat_member(p_chat_id uuid, p_user_id uuid) RETURNS void
Caller must be admin of the chat

Chat must be type='group'

Reject if the user is already a member

Reject if the user has blocked any member or vice versa (or allow? — DECISION: reject with clear error)

Insert chat_members

4.5 accept_chat_request(p_request_id uuid) RETURNS void
Caller must be the recipient_id of the request

Request must be status='pending'

Update chat_requests: status='accepted', responded_at=now()

Update chats: status='active'

Insert chat_members for recipient

4.6 reject_chat_request(p_request_id uuid) RETURNS void
Caller must be the recipient_id

Request must be status='pending'

Update chat_requests: status='rejected', responded_at=now()

Update chats: status='rejected', rejected_at=now()

Do NOT delete the chat; the sender keeps visibility of the rejection

4.7 create_channel(p_name text, p_slug text, p_description text) RETURNS uuid
Validate p_slug matches ^[a-z0-9-]{3,50}$ and is unique

Insert channels row (owner_id=auth.uid())

Insert channel_followers for owner (auto-follow)

Return channel id

4.8 follow_channel(p_channel_id uuid) RETURNS void
Insert channel_followers (ON CONFLICT DO NOTHING)

Trigger handles follower_count

4.9 create_community(p_name text, p_description text) RETURNS uuid
Insert communities row (owner_id=auth.uid())

Insert community_members for owner (role='admin')

Trigger handles member_count

No auto-chat creation — communities start empty; owner creates chats via create_community_chat (not in MVP)

4.10 join_community(p_community_id uuid) RETURNS void
Insert community_members (ON CONFLICT DO NOTHING)

Trigger auto-joins all community_chats

Trigger increments member_count

4.11 mark_chat_as_read(p_chat_id uuid) RETURNS void
Caller must be a chat member

Update chat_members.last_read_at = now() for caller

Update all message_receipts.read_at = now() where user_id = auth.uid()
and read_at IS NULL and the message belongs to p_chat_id

4.12 delete_message_for_everyone(p_message_id uuid) RETURNS void
Caller must be sender_id of the message

messages.deleted_at IS NULL (not already deleted)

(now() - messages.created_at) < interval '1 hour' else RAISE EXCEPTION

Update deleted_at=now(), deleted_for_everyone=true

Trigger messages_after_update handles preview if it was the last message

4.13 get_my_storage_usage() RETURNS bigint
Returns COALESCE(SUM(size_bytes), 0) from file_uploads

Filtered to uploader_id = auth.uid() and status = 'completed'

Used by the settings screen ("You are using X MB")

4.14 Grants for all RPCs
sql
GRANT EXECUTE ON FUNCTION public.create_direct_chat_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_self_chat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_chat(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_chat_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_chat_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_chat_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_channel(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.follow_channel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_community(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_community(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_chat_as_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_message_for_everyone(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_storage_usage() TO authenticated;
5. REALTIME PUBLICATION
Enable Realtime replication on the following tables. The client subscribes
to postgres_changes events; Supabase Realtime respects RLS on each event.

sql
-- Enable Realtime on these tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
Rationale:

messages (INSERT/UPDATE) — new messages, edits, delete-for-everyone

chat_members (INSERT/DELETE) — you've been added to / removed from a chat

calls (INSERT/UPDATE) — incoming call, status changes (answered, missed,
ended)

message_receipts (UPDATE) — read receipt propagation to sender

stories (INSERT/DELETE) — new story notification from contacts

Explicitly NOT realtime (client refetches on focus/refresh):

chats (too chatty: every message triggers an UPDATE via denormalization)

channel_followers, community_members (counters only)

message_reactions (MVP refetch on message refocus)

typing indicators (Fase 2: use Supabase Realtime Broadcast channels)

6. CRON JOBS (pg_cron)
sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
6.1 cleanup_stale_calls — every minute
sql
SELECT cron.schedule(
  'cleanup_stale_calls',
  '* * * * *',
  $$
    UPDATE public.calls
    SET status = 'missed', ended_at = now()
    WHERE status = 'ringing'
      AND started_at < now() - interval '60 seconds';
  $$
);
6.2 cleanup_expired_stories — every hour at :00
sql
SELECT cron.schedule(
  'cleanup_expired_stories',
  '0 * * * *',
  $$
    DELETE FROM public.stories
    WHERE expires_at < now() - interval '1 hour';
  $$
);
(1-hour grace period so users who are actively viewing see them expire
gracefully.)

6.3 cleanup_pending_uploads — every hour at :15
sql
SELECT cron.schedule(
  'cleanup_pending_uploads',
  '15 * * * *',
  $$
    DELETE FROM public.file_uploads
    WHERE status = 'pending'
      AND created_at < now() - interval '1 hour';
  $$
);
(If the client crashed or the upload failed mid-way, mark as orphan after 1h.)

6.4 cleanup_orphan_uploads — daily at 03:00 UTC
sql
SELECT cron.schedule(
  'cleanup_orphan_uploads',
  '0 3 * * *',
  $$
    DELETE FROM public.file_uploads
    WHERE status = 'completed'
      AND created_at < now() - interval '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.messages WHERE file_upload_id = file_uploads.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.stories WHERE file_upload_id = file_uploads.id
      );
  $$
);
6.5 Known limitation (documented, not fixed in this prompt)
The cron jobs above clean DB rows, but they do NOT delete the actual files
from Supabase Storage. Orphan storage files accumulate on the free tier
(~1GB). Deleting storage files requires calling the Supabase Storage API
from an Edge Function, triggered via pg_net from pg_cron.

This is Fase 2. For MVP, orphan storage usage is expected and tolerated.

7. WHAT NOT TO INCLUDE
❌ No GDPR purge of deleted messages (Fase 2)

❌ No Edge Function for storage cleanup (Fase 2)

❌ No Supabase Presence / typing indicators (Fase 2: Realtime Broadcast)

❌ No ownership transfer for communities/channels (Fase 2)

❌ No create_community_chat RPC (Fase 2)

❌ No seed data

❌ No frontend code

8. HOW TO RESPOND
Respond in this exact order:

One-paragraph confirmation listing: 5 policy amendments, 6 trigger
functions, 13 RPCs, 5 Realtime tables, 4 cron jobs, and 2 documented
limitations (storage orphan accumulation, no GDPR purge).

Complete SQL migration file supabase/migrations/0003_business_logic.sql:

Section 1: Policy amendments (DROP + CREATE for 3 policies, ALTER for
channels column)

Section 2: compute_message_preview() helper

Section 3: All 6 trigger functions + CREATE TRIGGER statements

Section 4: All 13 RPC functions + GRANT statements

Section 5: ALTER PUBLICATION supabase_realtime ADD TABLE statements

Section 6: CREATE EXTENSION pg_cron + all cron.schedule calls

All in the exact order above, with SQL comments labeling each section

A summary table:

Component	Count	Purpose
Policy amendments	3	Fix pending-request flow + leave-chat rules
Trigger functions	6	Auto-receipts, denorm counters, group cleanup
RPCs	13	Atomic multi-table operations
Realtime tables	5	Live events (messages, calls, receipts, ...)
Cron jobs	4	Cleanup housekeeping
A flow narrative in plain English for the developer, explaining the
end-to-end journey of a stranger-initiated chat request:

Alice opens Bob's profile → taps "Message"

Frontend calls create_direct_chat_request(bob_id, "Hi!")

What the RPC creates in DB (chat, chat_members, chat_requests, message)

What Bob sees (chat request notification + ability to read the message
but not write)

What Bob's UI calls when accepting (accept_chat_request)

What happens if Bob rejects (reject_chat_request + cooldown)

What happens if Alice retries after 7 days (status reset, new request)

A verification checklist the developer can run manually:

supabase db reset applies 0001 + 0002 + 0003 without errors

Query SELECT * FROM cron.job; shows 4 jobs

Query SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime';
shows the 5 tables

Insert a message → message_receipts auto-populated, chats.last_message_*
updated

Delete-for-everyone on the last message → chats.last_message_preview
becomes "This message was deleted"

Join a community → auto-added to all its community_chats,
member_count incremented

Leave last admin from a group → oldest member promoted to admin

Leave last member from a group → chat deleted (cascade)

Call get_my_storage_usage() → returns expected sum

Realtime: subscribe to messages on a chat from another session, send
a message → realtime fires

A short list of pitfalls to warn the developer:

Why SECURITY DEFINER + SET search_path = public on every trigger and
RPC (prevents privilege escalation via search_path hijacking)

Why the 7-day cooldown is enforced in create_direct_chat_request, not
via a trigger (it's a business rule, not a data integrity rule)

Why handle_new_message uses ON CONFLICT DO NOTHING on receipts
(idempotency for retried inserts)

Why chat_members DELETE blocks direct/self chats (would break
direct_pair_key UNIQUE constraint on re-creation)

Why the messages_select amendment uses chat_requests JOIN instead of
adding the recipient as a chat_member (keeps membership semantic clean)

Why ALTER PUBLICATION ... ADD TABLE is needed (Realtime is opt-in per
table)

Why pg_cron jobs clean DB rows but NOT storage files (needs Edge
Function; documented as Fase 2)

Why handle_chat_member_delete checks type IN ('group', 'community_chat')
before doing anything (direct/self chats must never be deleted by member
removal)

Do not implement Fase 2 features. Do not implement storage cleanup.
Do not implement presence or typing indicators.
```
