-- Shared roles, permissions, privacy projections, and lock-ordered enforcement
-- across Groups, Channels, and Communities.
BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1. GROUPS & SHARED CHATS SCHEMA + BACKFILL (OC-01, OC-09, OC-10)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS only_admins_can_add_members boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS only_admins_can_share_link boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS only_admins_can_edit_info boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_admin_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS write_policy text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS system_role text;

ALTER TABLE public.chats DROP CONSTRAINT IF EXISTS chats_write_policy_check;
ALTER TABLE public.chats ADD CONSTRAINT chats_write_policy_check
  CHECK (write_policy IN ('owner_only', 'admins', 'moderators', 'all'));

ALTER TABLE public.chats DROP CONSTRAINT IF EXISTS chats_system_role_check;
ALTER TABLE public.chats ADD CONSTRAINT chats_system_role_check
  CHECK (system_role IS NULL OR (type = 'community_chat' AND system_role = 'announcements'));

DROP INDEX IF EXISTS public.idx_chats_community_announcements;
CREATE UNIQUE INDEX idx_chats_community_announcements
  ON public.chats (community_id)
  WHERE system_role = 'announcements';

-- Revoke direct client metadata updates on public.chats (closes 0002 raw PATCH gap).
REVOKE UPDATE (name, description, avatar_url) ON public.chats FROM authenticated;
DROP POLICY IF EXISTS "chats_update_admin_or_creator" ON public.chats;

-- Backfill existing groups (OC-09): preserve historical admin-only restrictions
-- for add/share/edit and keep stored only_admins_can_send unchanged.
DO $$
DECLARE
  v_grp RECORD;
  v_owner uuid;
BEGIN
  FOR v_grp IN SELECT id, created_by, only_admins_can_send FROM public.chats WHERE type = 'group' LOOP
    v_owner := NULL;
    IF v_grp.created_by IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.chat_members WHERE chat_id = v_grp.id AND user_id = v_grp.created_by
    ) THEN
      v_owner := v_grp.created_by;
    ELSE
      SELECT user_id INTO v_owner
      FROM public.chat_members
      WHERE chat_id = v_grp.id
      ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, joined_at ASC, user_id ASC
      LIMIT 1;
    END IF;

    IF v_owner IS NOT NULL THEN
      UPDATE public.chat_members SET role = 'admin' WHERE chat_id = v_grp.id AND user_id = v_owner;
    END IF;

    UPDATE public.chats
    SET
      owner_id = v_owner,
      only_admins_can_add_members = true,
      only_admins_can_share_link = true,
      only_admins_can_edit_info = true,
      require_admin_approval = false,
      write_policy = CASE WHEN v_grp.only_admins_can_send THEN 'admins' ELSE 'all' END
    WHERE id = v_grp.id;
  END LOOP;
END $$;

-- Group invite links & join-approval requests
CREATE TABLE IF NOT EXISTS public.chat_invite_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL UNIQUE REFERENCES public.chats(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_join_requests_pending
  ON public.group_join_requests (chat_id, target_user_id)
  WHERE status = 'pending';

ALTER TABLE public.chat_invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_invite_links, public.group_join_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.chat_invite_links, public.group_join_requests TO authenticated;

-- Backfill one active invite link for each existing group
INSERT INTO public.chat_invite_links (chat_id, created_by)
SELECT id, owner_id FROM public.chats WHERE type = 'group'
ON CONFLICT (chat_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- 2. CHANNELS TABLES & BACKFILL (OC-02, OC-03, OC-04)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.channel_staff (
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_staff_user ON public.channel_staff (user_id);

CREATE TABLE IF NOT EXISTS public.channel_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE (channel_id, sender_id, recipient_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_invitations_recipient
  ON public.channel_invitations (recipient_id, status)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.channel_feed_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  message_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('insert', 'update', 'delete')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channel_feed_events_channel
  ON public.channel_feed_events (channel_id, created_at DESC);

ALTER TABLE public.channel_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_feed_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.channel_staff, public.channel_invitations, public.channel_feed_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.channel_staff, public.channel_feed_events TO authenticated;

-- Backfill channel_staff and OC-02 follower invariant
INSERT INTO public.channel_staff (channel_id, user_id, role, joined_at)
SELECT id, owner_id, 'owner', created_at
FROM public.channels
WHERE owner_id IS NOT NULL
ON CONFLICT (channel_id, user_id) DO UPDATE SET role = 'owner';

INSERT INTO public.channel_followers (channel_id, user_id)
SELECT id, owner_id
FROM public.channels
WHERE owner_id IS NOT NULL
ON CONFLICT (channel_id, user_id) DO NOTHING;

UPDATE public.channels c
SET follower_count = (
  SELECT count(*) FROM public.channel_followers cf WHERE cf.channel_id = c.id
);

-- ═══════════════════════════════════════════════════════════════════
-- 3. COMMUNITIES TABLES & BACKFILL (OC-05, OC-06, OC-07, OC-10)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.community_members
  ADD COLUMN IF NOT EXISTS silenced_until timestamptz,
  ADD COLUMN IF NOT EXISTS silenced_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS silence_reason text;

CREATE TABLE IF NOT EXISTS public.community_announcement_writers (
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.community_bans (
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  banned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.community_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_chat_id uuid REFERENCES public.chats(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_audit_logs_community
  ON public.community_audit_logs (community_id, created_at DESC, id DESC);

ALTER TABLE public.community_announcement_writers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_announcement_writers, public.community_bans, public.community_audit_logs
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.community_announcement_writers, public.community_bans, public.community_audit_logs
  TO authenticated;

-- OC-10: Pre-flight Avisos cardinality check and single-run backfill
DO $$
DECLARE
  v_comm RECORD;
  v_avisos_count integer;
  v_avisos_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.chats
    WHERE type = 'community_chat' AND lower(btrim(name)) = 'avisos'
    GROUP BY community_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple Avisos chats detected in an existing community; manual review required before migration';
  END IF;

  FOR v_comm IN SELECT id, owner_id FROM public.communities LOOP
    SELECT count(*), min(id)
    INTO v_avisos_count, v_avisos_id
    FROM public.chats
    WHERE community_id = v_comm.id
      AND type = 'community_chat'
      AND lower(btrim(name)) = 'avisos';

    IF v_avisos_count = 1 THEN
      UPDATE public.chats
      SET system_role = 'announcements',
          write_policy = 'admins',
          only_admins_can_send = true
      WHERE id = v_avisos_id;
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.chats WHERE community_id = v_comm.id AND system_role = 'announcements'
    ) THEN
      INSERT INTO public.chats (
        type, status, name, community_id, created_by, system_role, write_policy, only_admins_can_send
      )
      VALUES (
        'community_chat', 'active', 'Avisos', v_comm.id, v_comm.owner_id, 'announcements', 'admins', true
      )
      RETURNING id INTO v_avisos_id;

      INSERT INTO public.chat_members (chat_id, user_id, role)
      SELECT v_avisos_id, cm.user_id, cm.role
      FROM public.community_members cm
      WHERE cm.community_id = v_comm.id
      ON CONFLICT (chat_id, user_id) DO NOTHING;
    END IF;
  END LOOP;

  UPDATE public.chats
  SET write_policy = CASE WHEN only_admins_can_send THEN 'admins' ELSE 'all' END
  WHERE type = 'community_chat' AND system_role IS NULL;
END $$;

-- Attach restrictive AAL2 MFA policy to all new public tables
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'chat_invite_links', 'group_join_requests',
    'channel_staff', 'channel_invitations', 'channel_feed_events',
    'community_announcement_writers', 'community_bans', 'community_audit_logs'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY mfa_assurance_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.auth_mfa_satisfied())) WITH CHECK ((SELECT public.auth_mfa_satisfied()))',
      tbl
    );
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. SECURITY DEFINER AUTHORIZATION HELPERS
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_group_owner(p_chat_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied()
    AND public.is_chat_member(p_chat_id, p_user_id)
    AND EXISTS (
      SELECT 1 FROM public.chats
      WHERE id = p_chat_id AND type = 'group' AND owner_id = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner_or_admin(p_chat_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied()
    AND public.is_chat_member(p_chat_id, p_user_id)
    AND (
      public.is_group_owner(p_chat_id, p_user_id)
      OR public.is_chat_admin(p_chat_id, p_user_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_share_group_invite(p_chat_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied()
    AND public.is_chat_member(p_chat_id, p_user_id)
    AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = p_chat_id
        AND c.type = 'group'
        AND (NOT c.only_admins_can_share_link OR public.is_group_owner_or_admin(p_chat_id, p_user_id))
    );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_group_info(p_chat_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied()
    AND public.is_chat_member(p_chat_id, p_user_id)
    AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = p_chat_id
        AND c.type = 'group'
        AND (NOT c.only_admins_can_edit_info OR public.is_group_owner_or_admin(p_chat_id, p_user_id))
    );
$$;

CREATE OR REPLACE FUNCTION public.can_add_group_members(p_chat_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied()
    AND public.is_chat_member(p_chat_id, p_user_id)
    AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = p_chat_id
        AND c.type = 'group'
        AND (NOT c.only_admins_can_add_members OR public.is_group_owner_or_admin(p_chat_id, p_user_id))
    );
$$;

CREATE OR REPLACE FUNCTION public.is_channel_staff(p_channel_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied()
    AND EXISTS (
      SELECT 1 FROM public.channel_staff
      WHERE channel_id = p_channel_id AND user_id = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.community_role_rank(p_community_id uuid, p_user_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN p_user_id IS NULL THEN 0
    WHEN EXISTS (SELECT 1 FROM public.communities WHERE id = p_community_id AND owner_id = p_user_id) THEN 4
    ELSE COALESCE((
      SELECT CASE role
        WHEN 'admin' THEN 3
        WHEN 'moderator' THEN 2
        WHEN 'member' THEN 1
        ELSE 0
      END
      FROM public.community_members
      WHERE community_id = p_community_id AND user_id = p_user_id
    ), 0)
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_community_staff(p_community_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied() AND public.community_role_rank(p_community_id, p_user_id) >= 2;
$$;

CREATE OR REPLACE FUNCTION public.is_community_admin_or_owner(p_community_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied() AND public.community_role_rank(p_community_id, p_user_id) >= 3;
$$;

CREATE OR REPLACE FUNCTION public.can_write_community_chat(p_chat_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chats c
    JOIN public.community_members cm
      ON cm.community_id = c.community_id AND cm.user_id = p_user_id
    WHERE c.id = p_chat_id
      AND c.type = 'community_chat'
      AND (cm.silenced_until IS NULL OR cm.silenced_until <= now())
      AND (
        CASE
          WHEN c.system_role = 'announcements' THEN
            public.community_role_rank(c.community_id, p_user_id) >= 3
            OR (
              cm.role = 'moderator'
              AND EXISTS (
                SELECT 1 FROM public.community_announcement_writers w
                WHERE w.community_id = c.community_id AND w.user_id = p_user_id
              )
            )
          ELSE
            CASE c.write_policy
              WHEN 'owner_only' THEN public.community_role_rank(c.community_id, p_user_id) >= 4
              WHEN 'admins'     THEN public.community_role_rank(c.community_id, p_user_id) >= 3
              WHEN 'moderators' THEN public.community_role_rank(c.community_id, p_user_id) >= 2
              ELSE true
            END
        END
      )
  );
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 5. PRIVACY VIEWS & LOCKED-DOWN RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.channels_public
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  c.id,
  c.name,
  c.slug,
  c.description,
  c.avatar_url,
  c.is_verified,
  c.follower_count,
  c.last_message_id,
  c.last_message_at,
  c.last_message_preview,
  c.created_at,
  c.updated_at
FROM public.channels c
WHERE public.auth_mfa_satisfied();

CREATE OR REPLACE VIEW public.channel_invitations_sent
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  i.id,
  i.channel_id,
  i.recipient_id,
  CASE WHEN i.status = 'accepted' THEN 'accepted' ELSE 'pending' END AS status,
  i.created_at,
  i.accepted_at
FROM public.channel_invitations i
WHERE public.auth_mfa_satisfied() AND i.sender_id = auth.uid();

CREATE OR REPLACE VIEW public.channel_invitations_received
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  i.id,
  i.channel_id,
  i.status,
  i.created_at
FROM public.channel_invitations i
WHERE public.auth_mfa_satisfied()
  AND i.recipient_id = auth.uid()
  AND i.status = 'pending';

CREATE OR REPLACE VIEW public.message_media_public
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  f.id,
  f.bucket,
  f.path,
  f.original_filename,
  f.mime_type,
  f.size_bytes,
  f.width,
  f.height,
  f.duration_seconds,
  f.status,
  f.created_at,
  f.completed_at
FROM public.file_uploads f
WHERE public.auth_mfa_satisfied()
  AND (
    f.uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE (m.file_upload_id = f.id OR m.media_thumbnail_upload_id = f.id)
        AND NOT m.deleted_for_everyone
        AND (
          (m.channel_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.channels c WHERE c.id = m.channel_id))
          OR (m.chat_id IS NOT NULL AND public.can_access_chat_message(m.id))
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.stories s
      WHERE (s.file_upload_id = f.id OR s.media_thumbnail_upload_id = f.id)
        AND public.can_view_story(s.user_id, auth.uid())
    )
  );

ALTER VIEW public.channels_public OWNER TO postgres;
ALTER VIEW public.channel_invitations_sent OWNER TO postgres;
ALTER VIEW public.channel_invitations_received OWNER TO postgres;
ALTER VIEW public.message_media_public OWNER TO postgres;

REVOKE ALL ON public.channels_public, public.channel_invitations_sent, public.channel_invitations_received, public.message_media_public
  FROM PUBLIC, anon, service_role;
GRANT SELECT ON public.channels_public, public.channel_invitations_sent, public.channel_invitations_received, public.message_media_public
  TO authenticated;

-- RLS policies for new tables
CREATE POLICY "chat_invite_links_select_permitted" ON public.chat_invite_links
  FOR SELECT TO authenticated
  USING (is_active AND public.can_share_group_invite(chat_id, (SELECT auth.uid())));

CREATE POLICY "group_join_requests_select" ON public.group_join_requests
  FOR SELECT TO authenticated
  USING (
    public.is_group_owner_or_admin(chat_id, (SELECT auth.uid()))
    OR requested_by = (SELECT auth.uid())
    OR target_user_id = (SELECT auth.uid())
  );

CREATE POLICY "channel_staff_select_staff" ON public.channel_staff
  FOR SELECT TO authenticated
  USING (public.is_channel_staff(channel_id, (SELECT auth.uid())));

CREATE POLICY "channel_feed_events_select" ON public.channel_feed_events
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "community_announcement_writers_select" ON public.community_announcement_writers
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_community_staff(community_id, (SELECT auth.uid()))
  );

CREATE POLICY "community_bans_select_staff" ON public.community_bans
  FOR SELECT TO authenticated
  USING (public.is_community_staff(community_id, (SELECT auth.uid())));

CREATE POLICY "community_audit_logs_select_staff" ON public.community_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_community_staff(community_id, (SELECT auth.uid())));

-- Lock down base channel, follower, message, upload, storage, and report policies
DROP POLICY IF EXISTS "channels_select_authenticated" ON public.channels;
CREATE POLICY "channels_select_staff" ON public.channels
  FOR SELECT TO authenticated
  USING (public.is_channel_staff(id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "channel_followers_select" ON public.channel_followers;
CREATE POLICY "channel_followers_select_own" ON public.channel_followers
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = (SELECT auth.uid())
    AND reported_chat_id IS NULL
    AND reported_message_id IS NULL
    AND reason IN ('spam', 'harassment', 'inappropriate', 'other')
    AND char_length(coalesce(description, '')) <= 500
    AND (reason <> 'other' OR char_length(btrim(coalesce(description, ''))) > 0)
    AND (
      (
        reported_channel_id IS NOT NULL
        AND reported_user_id IS NULL
        AND EXISTS (SELECT 1 FROM public.channels_public cp WHERE cp.id = reports.reported_channel_id)
        AND NOT public.is_channel_owner(reports.reported_channel_id, (SELECT auth.uid()))
      )
      OR (
        reported_user_id IS NOT NULL
        AND reported_channel_id IS NULL
        AND reported_user_id <> (SELECT auth.uid())
        AND EXISTS (SELECT 1 FROM public.profiles_visible p WHERE p.id = reports.reported_user_id)
      )
    )
  );

DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated
  USING (
    (
      chat_id IS NOT NULL
      AND (
        public.is_chat_member(chat_id, (SELECT auth.uid()))
        OR EXISTS (
          SELECT 1 FROM public.chat_requests cr
          WHERE cr.chat_id = messages.chat_id
            AND cr.recipient_id = (SELECT auth.uid())
            AND cr.status = 'pending'
        )
      )
      AND NOT public.is_message_deleted_for_user(id, (SELECT auth.uid()))
    )
    OR
    (
      channel_id IS NOT NULL
      AND public.is_channel_staff(channel_id, (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND (
      (
        chat_id IS NOT NULL
        AND public.is_chat_member(chat_id, (SELECT auth.uid()))
        AND (
          public.is_chat_active(chat_id)
          OR EXISTS (
            SELECT 1 FROM public.chat_requests cr
            WHERE cr.chat_id = messages.chat_id
              AND cr.sender_id = (SELECT auth.uid())
              AND cr.status = 'pending'
          )
        )
        AND (
          NOT EXISTS (SELECT 1 FROM public.chats c WHERE c.id = messages.chat_id AND c.type = 'group')
          OR NOT EXISTS (SELECT 1 FROM public.chats c WHERE c.id = messages.chat_id AND c.only_admins_can_send)
          OR public.is_group_owner_or_admin(messages.chat_id, (SELECT auth.uid()))
        )
        AND (
          NOT EXISTS (SELECT 1 FROM public.chats c WHERE c.id = messages.chat_id AND c.type = 'community_chat')
          OR public.can_write_community_chat(messages.chat_id, (SELECT auth.uid()))
        )
      )
      OR
      (channel_id IS NOT NULL AND public.is_channel_staff(channel_id, (SELECT auth.uid())))
    )
  );

DROP POLICY IF EXISTS "reactions_insert_accessible_message" ON public.message_reactions;
CREATE POLICY "reactions_insert_accessible_message" ON public.message_reactions
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND NOT m.deleted_for_everyone
        AND m.type <> 'system'
        AND m.chat_id IS NOT NULL
        AND public.is_chat_member(m.chat_id, (SELECT auth.uid()))
    )
  );

-- Restrict channel-media & channel avatar rows in file_uploads and storage.objects to staff/uploader
DROP POLICY IF EXISTS "file_uploads_select_public_channel" ON public.file_uploads;
DROP POLICY IF EXISTS "file_uploads_select_novedades_thumbnail" ON public.file_uploads;
DROP POLICY IF EXISTS "file_uploads_select" ON public.file_uploads;
DROP POLICY IF EXISTS "file_uploads_select_message_media" ON public.file_uploads;

CREATE POLICY "file_uploads_select" ON public.file_uploads
  FOR SELECT TO authenticated
  USING (
    uploader_id = (SELECT auth.uid())
    OR (
      bucket = 'chat-media'
      AND EXISTS (
        SELECT 1 FROM public.messages m
        WHERE (m.file_upload_id = file_uploads.id OR m.media_thumbnail_upload_id = file_uploads.id)
          AND (
            public.is_chat_member(m.chat_id, (SELECT auth.uid()))
            OR EXISTS (
              SELECT 1 FROM public.chat_requests r
              WHERE r.chat_id = m.chat_id AND r.recipient_id = (SELECT auth.uid()) AND r.status = 'pending'
            )
          )
      )
    )
    OR (
      bucket = 'channel-media'
      AND split_part(path, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND public.is_channel_staff((split_part(path, '/', 1))::uuid, (SELECT auth.uid()))
    )
    OR (
      bucket = 'story-media'
      AND EXISTS (
        SELECT 1 FROM public.stories s
        WHERE (s.file_upload_id = file_uploads.id OR s.media_thumbnail_upload_id = file_uploads.id)
          AND public.can_view_story(s.user_id, (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "channel_media_select_public" ON storage.objects;
DROP POLICY IF EXISTS "channel_media_select_forwarded" ON storage.objects;
DROP POLICY IF EXISTS "channel_media_insert_owner" ON storage.objects;
DROP POLICY IF EXISTS "channel_media_delete_owner" ON storage.objects;

CREATE POLICY "channel_media_select_staff" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'channel-media'
    AND split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_channel_staff((split_part(name, '/', 1))::uuid, (SELECT auth.uid()))
  );

CREATE POLICY "channel_media_insert_staff" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'channel-media'
    AND split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_channel_staff((split_part(name, '/', 1))::uuid, (SELECT auth.uid()))
  );

CREATE POLICY "channel_media_delete_staff" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'channel-media'
    AND split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_channel_staff((split_part(name, '/', 1))::uuid, (SELECT auth.uid()))
  );

-- Rebuild avatars bucket policies with active membership check for groups and staff-only SELECT for channel avatars
DROP POLICY IF EXISTS "avatars_select_visible" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_channel" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_channel" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_channel" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_channel" ON storage.objects;

CREATE POLICY "avatars_select_visible" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND CASE
      WHEN split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public.can_view_avatar(split_part(name, '/', 1)::uuid, (SELECT auth.uid()))
      WHEN split_part(name, '/', 1) ~ '^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND split_part(name, '/', 2) ~ '^channel-'
        THEN public.is_channel_staff(substring(split_part(name, '/', 1) from 6)::uuid, (SELECT auth.uid()))
      WHEN split_part(name, '/', 1) ~ '^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public.is_chat_member(substring(split_part(name, '/', 1) from 6)::uuid, (SELECT auth.uid()))
      ELSE false
    END
  );

CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND CASE
      WHEN split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN split_part(name, '/', 1)::uuid = (SELECT auth.uid())
      WHEN split_part(name, '/', 1) ~ '^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN CASE
          WHEN split_part(name, '/', 2) ~ '^channel-'
            THEN public.is_channel_owner(substring(split_part(name, '/', 1) from 6)::uuid, (SELECT auth.uid()))
          WHEN EXISTS (
            SELECT 1 FROM public.chats c
            WHERE c.id = substring(split_part(storage.objects.name, '/', 1) from 6)::uuid
              AND c.type = 'group'
          )
            THEN public.can_edit_group_info(substring(split_part(name, '/', 1) from 6)::uuid, (SELECT auth.uid()))
          ELSE public.is_chat_admin(substring(split_part(name, '/', 1) from 6)::uuid, (SELECT auth.uid()))
        END
      ELSE false
    END
  );

CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND CASE
      WHEN split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN split_part(name, '/', 1)::uuid = (SELECT auth.uid())
      WHEN split_part(name, '/', 1) ~ '^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN CASE
          WHEN split_part(name, '/', 2) ~ '^channel-'
            THEN public.is_channel_owner(substring(split_part(name, '/', 1) from 6)::uuid, (SELECT auth.uid()))
          WHEN EXISTS (
            SELECT 1 FROM public.chats c
            WHERE c.id = substring(split_part(storage.objects.name, '/', 1) from 6)::uuid
              AND c.type = 'group'
          )
            THEN public.can_edit_group_info(substring(split_part(name, '/', 1) from 6)::uuid, (SELECT auth.uid()))
          ELSE public.is_chat_admin(substring(split_part(name, '/', 1) from 6)::uuid, (SELECT auth.uid()))
        END
      ELSE false
    END
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND CASE
      WHEN split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN split_part(name, '/', 1)::uuid = (SELECT auth.uid())
      WHEN split_part(name, '/', 1) ~ '^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN CASE
          WHEN split_part(name, '/', 2) ~ '^channel-'
            THEN public.is_channel_owner(substring(split_part(name, '/', 1) from 6)::uuid, (SELECT auth.uid()))
          WHEN EXISTS (
            SELECT 1 FROM public.chats c
            WHERE c.id = substring(split_part(storage.objects.name, '/', 1) from 6)::uuid
              AND c.type = 'group'
          )
            THEN public.can_edit_group_info(substring(split_part(name, '/', 1) from 6)::uuid, (SELECT auth.uid()))
          ELSE public.is_chat_admin(substring(split_part(name, '/', 1) from 6)::uuid, (SELECT auth.uid()))
        END
      ELSE false
    END
  );

CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND CASE
      WHEN split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN split_part(name, '/', 1)::uuid = (SELECT auth.uid())
      WHEN split_part(name, '/', 1) ~ '^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN CASE
          WHEN split_part(name, '/', 2) ~ '^channel-'
            THEN public.is_channel_owner(substring(split_part(name, '/', 1) from 6)::uuid, (SELECT auth.uid()))
          WHEN EXISTS (
            SELECT 1 FROM public.chats c
            WHERE c.id = substring(split_part(storage.objects.name, '/', 1) from 6)::uuid
              AND c.type = 'group'
          )
            THEN public.can_edit_group_info(substring(split_part(name, '/', 1) from 6)::uuid, (SELECT auth.uid()))
          ELSE public.is_chat_admin(substring(split_part(name, '/', 1) from 6)::uuid, (SELECT auth.uid()))
        END
      ELSE false
    END
  );

-- ═══════════════════════════════════════════════════════════════════
-- 6. LOCK-ORDERED SERIALIZATION TRIGGERS & CHANNEL FEED EVENTS
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.serialize_chat_message_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_chat public.chats%ROWTYPE;
  v_cm public.community_members%ROWTYPE;
  v_allowed boolean;
BEGIN
  IF NEW.chat_id IS NULL OR NEW.type = 'system' THEN
    RETURN NEW;
  END IF;

  SELECT type, community_id INTO v_chat.type, v_chat.community_id
  FROM public.chats WHERE id = NEW.chat_id;

  IF v_chat.type IS NULL OR v_chat.type IN ('direct', 'self') THEN
    RETURN NEW;
  END IF;

  IF v_chat.type = 'group' THEN
    SELECT * INTO v_chat FROM public.chats WHERE id = NEW.chat_id FOR SHARE;
    IF v_chat.only_admins_can_send AND NOT public.is_group_owner_or_admin(NEW.chat_id, NEW.sender_id) THEN
      RAISE EXCEPTION 'Only admins can send messages in this chat' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF v_chat.type = 'community_chat' THEN
    -- Global lock order: communities -> chats -> community_members
    PERFORM 1 FROM public.communities WHERE id = v_chat.community_id FOR SHARE;
    SELECT * INTO v_chat FROM public.chats WHERE id = NEW.chat_id FOR SHARE;
    SELECT * INTO v_cm
    FROM public.community_members
    WHERE community_id = v_chat.community_id AND user_id = NEW.sender_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Community membership required' USING ERRCODE = '42501';
    END IF;
    IF v_cm.silenced_until IS NOT NULL AND v_cm.silenced_until > now() THEN
      RAISE EXCEPTION 'You are silenced in this community' USING ERRCODE = '42501';
    END IF;

    v_allowed := CASE
      WHEN v_chat.system_role = 'announcements' THEN
        public.community_role_rank(v_chat.community_id, NEW.sender_id) >= 3
        OR (
          v_cm.role = 'moderator'
          AND EXISTS (
            SELECT 1 FROM public.community_announcement_writers w
            WHERE w.community_id = v_chat.community_id AND w.user_id = NEW.sender_id
          )
        )
      ELSE
        CASE v_chat.write_policy
          WHEN 'owner_only' THEN public.community_role_rank(v_chat.community_id, NEW.sender_id) >= 4
          WHEN 'admins'     THEN public.community_role_rank(v_chat.community_id, NEW.sender_id) >= 3
          WHEN 'moderators' THEN public.community_role_rank(v_chat.community_id, NEW.sender_id) >= 2
          ELSE true
        END
    END;

    IF NOT v_allowed THEN
      RAISE EXCEPTION 'Not allowed to send messages in this chat' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS messages_01_serialize_write ON public.messages;
CREATE TRIGGER messages_01_serialize_write
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.serialize_chat_message_write();

CREATE OR REPLACE FUNCTION public.emit_channel_feed_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_channel uuid;
  v_msg uuid;
  v_kind text;
BEGIN
  v_channel := COALESCE(NEW.channel_id, OLD.channel_id);
  IF v_channel IS NULL THEN RETURN NULL; END IF;
  v_msg := COALESCE(NEW.id, OLD.id);
  v_kind := CASE TG_OP WHEN 'INSERT' THEN 'insert' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END;
  IF EXISTS (SELECT 1 FROM public.channels WHERE id = v_channel) THEN
    INSERT INTO public.channel_feed_events (channel_id, message_id, event_type)
    VALUES (v_channel, v_msg, v_kind);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS messages_after_channel_feed ON public.messages;
CREATE TRIGGER messages_after_channel_feed
  AFTER INSERT OR UPDATE OR DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.emit_channel_feed_event();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'channel_feed_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_feed_events;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 7. GROUP RPCs & SUCCESSION
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.create_group_chat(text, uuid[]);
CREATE FUNCTION public.create_group_chat(
  p_name text,
  p_member_ids uuid[],
  p_only_admins_can_add_members boolean DEFAULT false,
  p_only_admins_can_share_link boolean DEFAULT false,
  p_only_admins_can_send boolean DEFAULT false,
  p_only_admins_can_edit_info boolean DEFAULT false,
  p_require_admin_approval boolean DEFAULT false
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_chat_id uuid;
  v_send boolean := coalesce(p_only_admins_can_send, false);
BEGIN
  IF v_user IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'Group name is required'; END IF;
  IF length(btrim(p_name)) > 100 THEN RAISE EXCEPTION 'Group name must be between 1 and 100 characters'; END IF;
  IF p_member_ids IS NULL OR cardinality(p_member_ids) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'Choose 1 to 255 members excluding the creator';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_member_ids) AS u(id) WHERE id IS NULL OR id = v_user)
     OR (SELECT count(DISTINCT id) FROM unnest(p_member_ids) AS u(id)) <> cardinality(p_member_ids) THEN
    RAISE EXCEPTION 'Members must be distinct, non-null users excluding the creator';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_member_ids) AS u(id)
             WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)) THEN
    RAISE EXCEPTION 'A selected member does not exist';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_member_ids) AS u(id)
             WHERE public.is_blocked_either_way(v_user, u.id)) THEN
    RAISE EXCEPTION 'Cannot add a member blocked in either direction';
  END IF;

  INSERT INTO public.chats (
    type, name, created_by, owner_id,
    only_admins_can_add_members, only_admins_can_share_link,
    only_admins_can_send, only_admins_can_edit_info,
    require_admin_approval, write_policy
  )
  VALUES (
    'group', btrim(p_name), v_user, v_user,
    coalesce(p_only_admins_can_add_members, false),
    coalesce(p_only_admins_can_share_link, false),
    v_send,
    coalesce(p_only_admins_can_edit_info, false),
    coalesce(p_require_admin_approval, false),
    CASE WHEN v_send THEN 'admins' ELSE 'all' END
  )
  RETURNING id INTO v_chat_id;

  INSERT INTO public.chat_members (chat_id, user_id, role) VALUES (v_chat_id, v_user, 'admin');
  INSERT INTO public.chat_members (chat_id, user_id)
  SELECT v_chat_id, id FROM unnest(p_member_ids) AS u(id);

  INSERT INTO public.chat_invite_links (chat_id, created_by) VALUES (v_chat_id, v_user);
  RETURN v_chat_id;
END $$;

DROP FUNCTION IF EXISTS public.update_group_info(uuid, text, text, text, boolean);
CREATE FUNCTION public.update_group_info(
  p_chat_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_only_admins_can_send boolean DEFAULT NULL,
  p_only_admins_can_add_members boolean DEFAULT NULL,
  p_only_admins_can_share_link boolean DEFAULT NULL,
  p_only_admins_can_edit_info boolean DEFAULT NULL,
  p_require_admin_approval boolean DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_has_info boolean := p_name IS NOT NULL OR p_description IS NOT NULL OR p_avatar_url IS NOT NULL;
  v_has_perms boolean := p_only_admins_can_send IS NOT NULL
    OR p_only_admins_can_add_members IS NOT NULL
    OR p_only_admins_can_share_link IS NOT NULL
    OR p_only_admins_can_edit_info IS NOT NULL
    OR p_require_admin_approval IS NOT NULL;
  v_next_send boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.chats WHERE id = p_chat_id AND type = 'group' FOR UPDATE;
  IF NOT FOUND OR NOT public.is_chat_member(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Group membership required' USING ERRCODE = '42501';
  END IF;

  IF v_has_perms AND NOT public.is_group_owner_or_admin(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Group admin required' USING ERRCODE = '42501';
  END IF;

  IF v_has_info AND NOT public.can_edit_group_info(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to edit group info' USING ERRCODE = '42501';
  END IF;

  IF p_name IS NOT NULL AND (length(btrim(p_name)) < 1 OR length(p_name) > 100) THEN
    RAISE EXCEPTION 'Group name must be between 1 and 100 characters';
  END IF;
  IF length(p_description) > 500 THEN
    RAISE EXCEPTION 'Group description must be 500 characters or less';
  END IF;
  IF p_avatar_url IS NOT NULL AND p_avatar_url <> '' AND (
    p_avatar_url !~ ('^chat-' || p_chat_id::text || '/group-[a-zA-Z0-9-]+\.webp$')
    OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'avatars' AND name = p_avatar_url)
  ) THEN
    RAISE EXCEPTION 'Group photo must be uploaded to this chat';
  END IF;

  SELECT coalesce(p_only_admins_can_send, only_admins_can_send) INTO v_next_send
  FROM public.chats WHERE id = p_chat_id;

  UPDATE public.chats
  SET
    name = coalesce(p_name, name),
    description = coalesce(p_description, description),
    avatar_url = CASE
      WHEN p_avatar_url IS NULL THEN avatar_url
      ELSE nullif(p_avatar_url, '')
    END,
    only_admins_can_send = v_next_send,
    write_policy = CASE WHEN v_next_send THEN 'admins' ELSE 'all' END,
    only_admins_can_add_members = coalesce(p_only_admins_can_add_members, only_admins_can_add_members),
    only_admins_can_share_link = coalesce(p_only_admins_can_share_link, only_admins_can_share_link),
    only_admins_can_edit_info = coalesce(p_only_admins_can_edit_info, only_admins_can_edit_info),
    require_admin_approval = coalesce(p_require_admin_approval, require_admin_approval),
    updated_at = now()
  WHERE id = p_chat_id;
END $$;

CREATE OR REPLACE FUNCTION public.request_group_member_add(p_chat_id uuid, p_user_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid;
  v_added integer := 0;
  v_requested integer := 0;
  v_is_admin boolean;
  v_approval boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  SELECT require_admin_approval INTO v_approval
  FROM public.chats WHERE id = p_chat_id AND type = 'group' FOR UPDATE;
  IF NOT FOUND OR NOT public.can_add_group_members(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to add members' USING ERRCODE = '42501';
  END IF;
  IF cardinality(p_user_ids) IS NULL OR cardinality(p_user_ids) NOT BETWEEN 1 AND 50
     OR array_ndims(p_user_ids) <> 1 OR array_position(p_user_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Select between 1 and 50 members';
  END IF;

  v_is_admin := public.is_group_owner_or_admin(p_chat_id, auth.uid());

  FOR v_uid IN SELECT DISTINCT id FROM unnest(p_user_ids) id ORDER BY id LOOP
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid)
       AND NOT EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = p_chat_id AND user_id = v_uid)
       AND NOT EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = p_chat_id AND public.is_blocked_either_way(user_id, v_uid)) THEN
      IF v_is_admin OR NOT v_approval THEN
        IF (SELECT count(*) FROM public.chat_members WHERE chat_id = p_chat_id) >= 256 THEN
          RAISE EXCEPTION 'Group has reached its 256-member limit';
        END IF;
        INSERT INTO public.chat_members (chat_id, user_id, role)
        VALUES (p_chat_id, v_uid, 'member')
        ON CONFLICT DO NOTHING;
        IF FOUND THEN v_added := v_added + 1; END IF;
      ELSE
        INSERT INTO public.group_join_requests (chat_id, target_user_id, requested_by)
        VALUES (p_chat_id, v_uid, auth.uid())
        ON CONFLICT DO NOTHING;
        IF FOUND THEN v_requested := v_requested + 1; END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('added', v_added, 'requested', v_requested);
END $$;

CREATE OR REPLACE FUNCTION public.add_chat_members(p_chat_id uuid, p_user_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_res jsonb;
BEGIN
  v_res := public.request_group_member_add(p_chat_id, p_user_ids);
  RETURN coalesce((v_res->>'added')::integer, 0);
END $$;

CREATE OR REPLACE FUNCTION public.review_group_join_request(p_request_id uuid, p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_req public.group_join_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_req FROM public.group_join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  PERFORM 1 FROM public.chats WHERE id = v_req.chat_id AND type = 'group' FOR UPDATE;
  IF NOT FOUND OR NOT public.is_group_owner_or_admin(v_req.chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Group admin required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req FROM public.group_join_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is no longer pending';
  END IF;

  IF p_approve THEN
    IF EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = v_req.chat_id AND public.is_blocked_either_way(user_id, v_req.target_user_id)) THEN
      RAISE EXCEPTION 'User is blocked by or has blocked an existing member';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = v_req.chat_id AND user_id = v_req.target_user_id) THEN
      IF (SELECT count(*) FROM public.chat_members WHERE chat_id = v_req.chat_id) >= 256 THEN
        RAISE EXCEPTION 'Group has reached its 256-member limit';
      END IF;
      INSERT INTO public.chat_members (chat_id, user_id, role)
      VALUES (v_req.chat_id, v_req.target_user_id, 'member')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  UPDATE public.group_join_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = p_request_id;
END $$;

CREATE OR REPLACE FUNCTION public.get_group_invite(p_chat_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_token text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_share_group_invite(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to share group invite' USING ERRCODE = '42501';
  END IF;
  SELECT token INTO v_token FROM public.chat_invite_links WHERE chat_id = p_chat_id AND is_active;
  RETURN v_token;
END $$;

CREATE OR REPLACE FUNCTION public.rotate_group_invite(p_chat_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_token text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.chats WHERE id = p_chat_id AND type = 'group' FOR UPDATE;
  IF NOT FOUND OR NOT public.is_group_owner_or_admin(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Group admin required' USING ERRCODE = '42501';
  END IF;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  INSERT INTO public.chat_invite_links (chat_id, token, created_by, is_active, updated_at)
  VALUES (p_chat_id, v_token, auth.uid(), true, now())
  ON CONFLICT (chat_id) DO UPDATE
    SET token = excluded.token, created_by = auth.uid(), is_active = true, updated_at = now();
  RETURN v_token;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_group_invite(p_chat_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.chats WHERE id = p_chat_id AND type = 'group' FOR UPDATE;
  IF NOT FOUND OR NOT public.is_group_owner_or_admin(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Group admin required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.chat_invite_links SET is_active = false, updated_at = now() WHERE chat_id = p_chat_id;
END $$;

CREATE OR REPLACE FUNCTION public.join_group_via_invite(p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_chat_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  SELECT chat_id INTO v_chat_id FROM public.chat_invite_links WHERE token = p_token AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite link is invalid or revoked'; END IF;

  PERFORM 1 FROM public.chats WHERE id = v_chat_id AND type = 'group' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group unavailable'; END IF;

  IF public.is_chat_member(v_chat_id, auth.uid()) THEN
    RETURN v_chat_id;
  END IF;
  IF (SELECT count(*) FROM public.chat_members WHERE chat_id = v_chat_id) >= 256 THEN
    RAISE EXCEPTION 'Group has reached its 256-member limit';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_id = v_chat_id AND public.is_blocked_either_way(auth.uid(), user_id)
  ) THEN
    RAISE EXCEPTION 'Cannot join a group with a blocked user';
  END IF;

  INSERT INTO public.chat_members (chat_id, user_id, role)
  VALUES (v_chat_id, auth.uid(), 'member')
  ON CONFLICT DO NOTHING;

  UPDATE public.group_join_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE chat_id = v_chat_id AND target_user_id = auth.uid() AND status = 'pending';

  RETURN v_chat_id;
END $$;

CREATE OR REPLACE FUNCTION public.promote_chat_admin(p_chat_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.chats WHERE id = p_chat_id AND type = 'group' FOR UPDATE;
  IF NOT FOUND OR NOT public.is_group_owner_or_admin(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Group admin required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.chat_members SET role = 'admin' WHERE chat_id = p_chat_id AND user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member unavailable'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.demote_chat_admin(p_chat_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_owner uuid;
  v_target_role public.chat_member_role;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  SELECT owner_id INTO v_owner FROM public.chats WHERE id = p_chat_id AND type = 'group' FOR UPDATE;
  IF NOT FOUND OR NOT public.is_group_owner_or_admin(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Group admin required' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_target_role FROM public.chat_members WHERE chat_id = p_chat_id AND user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member unavailable'; END IF;
  IF p_user_id = v_owner THEN
    RAISE EXCEPTION 'Cannot demote the group owner' USING ERRCODE = '42501';
  END IF;
  IF v_target_role = 'admin' AND auth.uid() IS DISTINCT FROM v_owner THEN
    RAISE EXCEPTION 'Only the group owner can demote an admin' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = p_chat_id AND user_id <> p_user_id AND role = 'admin') THEN
    RAISE EXCEPTION 'At least one admin must remain';
  END IF;
  UPDATE public.chat_members SET role = 'member' WHERE chat_id = p_chat_id AND user_id = p_user_id;
END $$;

CREATE OR REPLACE FUNCTION public.remove_chat_member(p_chat_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_owner uuid;
  v_target_role public.chat_member_role;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  SELECT owner_id INTO v_owner FROM public.chats WHERE id = p_chat_id AND type = 'group' FOR UPDATE;
  IF NOT FOUND OR NOT public.is_group_owner_or_admin(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Group admin required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Use Leave group to remove yourself'; END IF;
  SELECT role INTO v_target_role FROM public.chat_members WHERE chat_id = p_chat_id AND user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member unavailable'; END IF;
  IF p_user_id = v_owner THEN
    RAISE EXCEPTION 'Cannot remove the group owner' USING ERRCODE = '42501';
  END IF;
  IF v_target_role = 'admin' AND auth.uid() IS DISTINCT FROM v_owner THEN
    RAISE EXCEPTION 'Only the group owner can remove an admin' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.chat_members WHERE chat_id = p_chat_id AND user_id = p_user_id;
END $$;

CREATE OR REPLACE FUNCTION public.transfer_group_ownership(p_chat_id uuid, p_new_owner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  SELECT owner_id INTO v_owner FROM public.chats WHERE id = p_chat_id AND type = 'group' FOR UPDATE;
  IF NOT FOUND OR v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the group owner can transfer ownership' USING ERRCODE = '42501';
  END IF;
  IF p_new_owner_id = auth.uid() THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_members WHERE chat_id = p_chat_id AND user_id = p_new_owner_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Target must be an existing group admin';
  END IF;
  UPDATE public.chats SET owner_id = p_new_owner_id, updated_at = now() WHERE id = p_chat_id;
END $$;

CREATE OR REPLACE FUNCTION public.handle_chat_member_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_chat_type public.chat_type;
  v_owner uuid;
  remaining_members int;
  oldest_successor uuid;
  v_member_name text;
  v_content text;
BEGIN
  SELECT type, owner_id INTO v_chat_type, v_owner
  FROM public.chats WHERE id = OLD.chat_id;

  IF v_chat_type IS NULL OR v_chat_type NOT IN ('group', 'community_chat') THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO remaining_members FROM public.chat_members WHERE chat_id = OLD.chat_id;

  IF v_chat_type = 'group' THEN
    IF remaining_members = 0 THEN
      DELETE FROM public.chats WHERE id = OLD.chat_id;
      RETURN OLD;
    END IF;

    IF OLD.user_id = v_owner OR (
      OLD.role = 'admin' AND NOT EXISTS (
        SELECT 1 FROM public.chat_members WHERE chat_id = OLD.chat_id AND role = 'admin'
      )
    ) THEN
      SELECT user_id INTO oldest_successor
      FROM public.chat_members
      WHERE chat_id = OLD.chat_id
      ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, joined_at ASC, user_id ASC
      LIMIT 1;

      IF oldest_successor IS NOT NULL THEN
        UPDATE public.chat_members SET role = 'admin'
        WHERE chat_id = OLD.chat_id AND user_id = oldest_successor;

        IF OLD.user_id = v_owner OR v_owner IS NULL THEN
          UPDATE public.chats SET owner_id = oldest_successor WHERE id = OLD.chat_id;
        END IF;
      END IF;
    END IF;
  END IF;

  IF remaining_members > 0 THEN
    SELECT COALESCE(NULLIF(btrim(display_name), ''), NULLIF(btrim(username), ''), 'Member')
    INTO v_member_name
    FROM public.profiles WHERE id = OLD.user_id;

    v_member_name := COALESCE(v_member_name, 'Member');
    v_content := CASE
      WHEN auth.uid() IS NOT NULL AND auth.uid() <> OLD.user_id THEN
        format('''%s'' was removed from the chat', v_member_name)
      ELSE
        format('''%s'' left the chat', v_member_name)
    END;

    INSERT INTO public.messages (chat_id, sender_id, type, content)
    VALUES (OLD.chat_id, NULL, 'system', v_content);
  END IF;

  RETURN OLD;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 8. CHANNEL RPCs & AUTHORIZATION
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.create_channel(text, text, text);
CREATE FUNCTION public.create_channel(
  p_name text,
  p_slug text,
  p_description text,
  p_channel_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid := coalesce(p_channel_id, gen_random_uuid());
  v_existing_owner uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;

  IF p_channel_id IS NOT NULL THEN
    SELECT owner_id INTO v_existing_owner FROM public.channels WHERE id = p_channel_id;
    IF FOUND THEN
      IF v_existing_owner = auth.uid() THEN
        RETURN p_channel_id;
      END IF;
      RAISE EXCEPTION 'Channel identifier already used';
    END IF;
  END IF;

  IF btrim(coalesce(p_name, '')) = '' OR length(p_name) > 100 THEN
    RAISE EXCEPTION 'Channel name must contain 1 to 100 characters';
  END IF;
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]{3,50}$' THEN
    RAISE EXCEPTION 'Slug must contain 3 to 50 lowercase letters, digits or hyphens';
  END IF;
  IF length(p_description) > 500 THEN
    RAISE EXCEPTION 'Description must be 500 characters or less';
  END IF;

  BEGIN
    INSERT INTO public.channels (id, name, slug, description, owner_id)
    VALUES (v_id, btrim(p_name), p_slug, p_description, auth.uid());
  EXCEPTION WHEN unique_violation THEN
    IF p_channel_id IS NOT NULL THEN
      SELECT owner_id INTO v_existing_owner FROM public.channels WHERE id = p_channel_id;
      IF FOUND AND v_existing_owner = auth.uid() THEN
        RETURN p_channel_id;
      END IF;
    END IF;
    RAISE EXCEPTION 'Channel slug is already taken';
  END;

  INSERT INTO public.channel_staff (channel_id, user_id, role)
  VALUES (v_id, auth.uid(), 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.channel_followers (channel_id, user_id)
  VALUES (v_id, auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.get_channel_viewer_context(p_channel_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'viewer_role', CASE
      WHEN NOT public.auth_mfa_satisfied() THEN NULL
      ELSE (SELECT role FROM public.channel_staff WHERE channel_id = p_channel_id AND user_id = auth.uid())
    END,
    'following', public.auth_mfa_satisfied() AND EXISTS (
      SELECT 1 FROM public.channel_followers WHERE channel_id = p_channel_id AND user_id = auth.uid()
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_channel_staff(p_channel_id uuid)
RETURNS TABLE (
  user_id uuid,
  role text,
  joined_at timestamptz,
  username text,
  display_name text,
  avatar_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT cs.user_id, cs.role, cs.joined_at, p.username, p.display_name, p.avatar_url
  FROM public.channel_staff cs
  JOIN public.profiles_visible p ON p.id = cs.user_id
  WHERE cs.channel_id = p_channel_id
    AND public.is_channel_staff(p_channel_id, auth.uid())
  ORDER BY CASE WHEN cs.role = 'owner' THEN 0 ELSE 1 END, cs.joined_at ASC, cs.user_id ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_channel_messages(
  p_channel_id uuid,
  p_before_at timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL
)
RETURNS SETOF public.messages LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  m public.messages;
  v_staff boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.channels WHERE id = p_channel_id) THEN RETURN; END IF;
  v_staff := public.is_channel_staff(p_channel_id, auth.uid());

  FOR m IN
    SELECT * FROM public.messages
    WHERE channel_id = p_channel_id
      AND NOT public.is_message_deleted_for_user(id, auth.uid())
      AND (p_before_at IS NULL OR (created_at, id) < (p_before_at, p_before_id))
    ORDER BY created_at DESC, id DESC
    LIMIT 50
  LOOP
    IF NOT v_staff THEN
      m.sender_id := NULL;
    END IF;
    IF m.deleted_for_everyone THEN
      m.content := NULL; m.contact_data := NULL; m.location_data := NULL;
      m.file_upload_id := NULL; m.media_thumbnail_upload_id := NULL;
      m.mentions := NULL; m.reply_to_message_id := NULL; m.type := 'text';
      m.media_peaks := NULL; m.forwarded_from_message_id := NULL;
    END IF;
    RETURN NEXT m;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.appoint_channel_admin(p_channel_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.channels WHERE id = p_channel_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_channel_owner(p_channel_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the channel owner can appoint admins' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF p_user_id = auth.uid() THEN RETURN; END IF;

  INSERT INTO public.channel_staff (channel_id, user_id, role)
  VALUES (p_channel_id, p_user_id, 'admin')
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  -- OC-02: every admin is counted in channel_followers once
  INSERT INTO public.channel_followers (channel_id, user_id)
  VALUES (p_channel_id, p_user_id)
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.remove_channel_admin(p_channel_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.channels WHERE id = p_channel_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_channel_owner(p_channel_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the channel owner can remove admins' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot remove the channel owner';
  END IF;
  DELETE FROM public.channel_staff
  WHERE channel_id = p_channel_id AND user_id = p_user_id AND role = 'admin';
END $$;

CREATE OR REPLACE FUNCTION public.transfer_channel_ownership(p_channel_id uuid, p_new_owner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.channels WHERE id = p_channel_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_channel_owner(p_channel_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the channel owner can transfer ownership' USING ERRCODE = '42501';
  END IF;
  IF p_new_owner_id = auth.uid() THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.channel_staff
    WHERE channel_id = p_channel_id AND user_id = p_new_owner_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Ownership transfer requires an existing channel admin';
  END IF;

  UPDATE public.channels SET owner_id = p_new_owner_id, updated_at = now() WHERE id = p_channel_id;
  UPDATE public.channel_staff SET role = 'owner' WHERE channel_id = p_channel_id AND user_id = p_new_owner_id;
  UPDATE public.channel_staff SET role = 'admin' WHERE channel_id = p_channel_id AND user_id = auth.uid();

  INSERT INTO public.channel_followers (channel_id, user_id)
  VALUES (p_channel_id, p_new_owner_id), (p_channel_id, auth.uid())
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.delete_channel(p_channel_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.channels WHERE id = p_channel_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_channel_owner(p_channel_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the channel owner can delete this channel' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.channels WHERE id = p_channel_id;
END $$;

CREATE OR REPLACE FUNCTION public.delete_channel_post(p_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_msg public.messages%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id AND channel_id IS NOT NULL FOR UPDATE;
  IF NOT FOUND OR v_msg.deleted_for_everyone THEN
    RAISE EXCEPTION 'Post unavailable';
  END IF;
  IF NOT (
    public.is_channel_owner(v_msg.channel_id, auth.uid())
    OR (public.is_channel_staff(v_msg.channel_id, auth.uid()) AND v_msg.sender_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized to delete this post' USING ERRCODE = '42501';
  END IF;

  UPDATE public.messages
  SET deleted_at = now(), deleted_for_everyone = true
  WHERE id = p_message_id;
END $$;

CREATE OR REPLACE FUNCTION public.unfollow_channel(p_channel_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  IF public.is_channel_staff(p_channel_id, auth.uid()) THEN
    RAISE EXCEPTION 'Channel staff cannot unfollow while in office' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.channel_followers WHERE channel_id = p_channel_id AND user_id = auth.uid();
END $$;

DROP FUNCTION IF EXISTS public.follow_channel(uuid);
CREATE FUNCTION public.follow_channel(p_channel_id uuid, p_invitation_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.channels WHERE id = p_channel_id) THEN
    RAISE EXCEPTION 'Channel does not exist';
  END IF;

  INSERT INTO public.channel_followers (channel_id, user_id)
  VALUES (p_channel_id, auth.uid())
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  IF p_invitation_id IS NOT NULL THEN
    UPDATE public.channel_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = p_invitation_id
      AND channel_id = p_channel_id
      AND recipient_id = auth.uid()
      AND status = 'pending';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.send_channel_invitations(p_channel_id uuid, p_invitations jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_item jsonb;
  v_inv_id uuid;
  v_recipient uuid;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.channels WHERE id = p_channel_id) THEN
    RAISE EXCEPTION 'Channel unavailable';
  END IF;
  IF NOT (public.is_channel_staff(p_channel_id, auth.uid()) OR public.is_channel_follower(p_channel_id, auth.uid())) THEN
    RAISE EXCEPTION 'Only channel members and staff can invite contacts' USING ERRCODE = '42501';
  END IF;
  IF p_invitations IS NULL OR jsonb_typeof(p_invitations) <> 'array' OR jsonb_array_length(p_invitations) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Provide between 1 and 50 invitations';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_invitations) LOOP
    v_inv_id := coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid());
    v_recipient := (v_item->>'recipient_id')::uuid;

    IF v_recipient IS NULL OR v_recipient = auth.uid()
       OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_recipient)
       OR NOT public.is_contact(auth.uid(), v_recipient)
       OR public.is_blocked_either_way(auth.uid(), v_recipient) THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'recipient_id', v_recipient, 'ok', false, 'reason', 'ineligible'
      ));
      CONTINUE;
    END IF;

    -- Do NOT check or disclose existing follower/staff status of recipient
    INSERT INTO public.channel_invitations (id, channel_id, sender_id, recipient_id)
    VALUES (v_inv_id, p_channel_id, auth.uid(), v_recipient)
    ON CONFLICT DO NOTHING;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'recipient_id', v_recipient, 'id', v_inv_id, 'ok', true
    ));
  END LOOP;

  RETURN v_results;
END $$;

CREATE OR REPLACE FUNCTION public.dismiss_channel_invitation(p_invitation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.channel_invitations
  SET status = 'dismissed'
  WHERE id = p_invitation_id AND recipient_id = auth.uid() AND status = 'pending';
END $$;

-- End-user-authorized media/avatar signing helpers (called by sign-channel-media on userClient)
CREATE OR REPLACE FUNCTION public.authorize_channel_post_media_read(p_upload_id uuid, p_channel_id uuid)
RETURNS TABLE (bucket text, path text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT f.bucket, f.path
  FROM public.file_uploads f
  JOIN public.messages m ON (m.file_upload_id = f.id OR m.media_thumbnail_upload_id = f.id)
  JOIN public.channels c ON c.id = m.channel_id
  WHERE f.id = p_upload_id
    AND f.bucket = 'channel-media'
    AND m.channel_id = p_channel_id
    AND NOT m.deleted_for_everyone
    AND m.deleted_at IS NULL
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Media unavailable' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.authorize_forwarded_channel_media_read(p_upload_id uuid, p_message_id uuid)
RETURNS TABLE (bucket text, path text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_access_chat_message(p_message_id) THEN
    RAISE EXCEPTION 'Message unavailable' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT f.bucket, f.path
  FROM public.file_uploads f
  JOIN public.messages m ON (m.file_upload_id = f.id OR m.media_thumbnail_upload_id = f.id)
  WHERE f.id = p_upload_id
    AND f.bucket = 'channel-media'
    AND m.id = p_message_id
    AND m.chat_id IS NOT NULL
    AND NOT m.deleted_for_everyone
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Media unavailable' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.authorize_channel_avatar_read(p_channel_id uuid, p_path text)
RETURNS TABLE (bucket text, path text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  IF p_path IS NULL OR p_path !~ ('^chat-' || p_channel_id::text || '/channel-[a-zA-Z0-9-]+\.webp$') THEN
    RAISE EXCEPTION 'Invalid channel avatar path' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT 'avatars'::text AS bucket, c.avatar_url AS path
  FROM public.channels c
  WHERE c.id = p_channel_id AND c.avatar_url = p_path
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Channel avatar unavailable' USING ERRCODE = '42501';
  END IF;
END $$;

-- Update can_access_chat_message & set_message_reaction (remove channel reactions; keep channel forward read)
CREATE OR REPLACE FUNCTION public.can_access_chat_message(p_message_id uuid, p_include_deleted boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND public.auth_mfa_satisfied() AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = p_message_id
      AND (p_include_deleted OR NOT m.deleted_for_everyone)
      AND NOT public.is_message_deleted_for_user(m.id, auth.uid())
      AND (
        (m.chat_id IS NOT NULL AND (
          public.is_chat_member(m.chat_id, auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.chat_requests r
            WHERE r.chat_id = m.chat_id AND r.recipient_id = auth.uid() AND r.status = 'pending'
          )
        ))
        OR (m.channel_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.channels c WHERE c.id = m.channel_id))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.set_message_reaction(p_message_id uuid, p_emoji text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.messages;
BEGIN
  IF NOT public.can_access_chat_message(p_message_id) THEN RAISE EXCEPTION 'Message unavailable'; END IF;
  SELECT * INTO m FROM public.messages WHERE id = p_message_id AND type <> 'system' AND NOT deleted_for_everyone FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Message unavailable'; END IF;
  IF m.channel_id IS NOT NULL THEN
    RAISE EXCEPTION 'Reactions are disabled in channels' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_chat_member(m.chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Chat membership required';
  END IF;
  IF p_emoji IS NULL THEN
    DELETE FROM public.message_reactions WHERE message_id = p_message_id AND user_id = auth.uid();
  ELSE
    IF length(p_emoji) < 1 OR length(p_emoji) > 32 THEN RAISE EXCEPTION 'Invalid reaction'; END IF;
    INSERT INTO public.message_reactions (message_id, user_id, emoji)
    VALUES (p_message_id, auth.uid(), p_emoji)
    ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = excluded.emoji, created_at = now();
  END IF;
END $$;

-- Channel owner succession on profile deletion
CREATE OR REPLACE FUNCTION public.handle_profile_deletion_channel_succession()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ch RECORD;
  v_next uuid;
BEGIN
  FOR v_ch IN SELECT id FROM public.channels WHERE owner_id = OLD.id ORDER BY id FOR UPDATE LOOP
    SELECT user_id INTO v_next
    FROM public.channel_staff
    WHERE channel_id = v_ch.id AND user_id <> OLD.id AND role = 'admin'
    ORDER BY joined_at ASC, user_id ASC
    LIMIT 1;

    IF v_next IS NOT NULL THEN
      UPDATE public.channels SET owner_id = v_next WHERE id = v_ch.id;
      UPDATE public.channel_staff SET role = 'owner' WHERE channel_id = v_ch.id AND user_id = v_next;
    END IF;
  END LOOP;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS profiles_before_delete_channel_succession ON public.profiles;
CREATE TRIGGER profiles_before_delete_channel_succession
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profile_deletion_channel_succession();

-- ═══════════════════════════════════════════════════════════════════
-- 9. COMMUNITY RPCs, SUCCESSION, MODERATION & AUDIT LOGS
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_community_chat_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.chat_members SET role = NEW.role
  WHERE user_id = NEW.user_id
    AND chat_id IN (SELECT id FROM public.chats WHERE community_id = NEW.community_id);

  IF NEW.role <> 'moderator' THEN
    DELETE FROM public.community_announcement_writers
    WHERE community_id = NEW.community_id AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.handle_community_member_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.communities SET member_count = member_count + 1 WHERE id = NEW.community_id;
  INSERT INTO public.chat_members (chat_id, user_id, role)
  SELECT c.id, NEW.user_id, NEW.role
  FROM public.chats c
  WHERE c.community_id = NEW.community_id
  ON CONFLICT (chat_id, user_id) DO UPDATE SET role = excluded.role;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.handle_community_member_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_was_owner boolean;
  v_next_owner uuid;
  v_remaining_count int;
BEGIN
  UPDATE public.communities SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.community_id;

  DELETE FROM public.community_announcement_writers
  WHERE community_id = OLD.community_id AND user_id = OLD.user_id;

  DELETE FROM public.chat_members
  WHERE user_id = OLD.user_id
    AND chat_id IN (SELECT id FROM public.chats WHERE community_id = OLD.community_id);

  SELECT (owner_id = OLD.user_id) INTO v_was_owner FROM public.communities WHERE id = OLD.community_id;
  IF v_was_owner THEN
    SELECT count(*) INTO v_remaining_count FROM public.community_members WHERE community_id = OLD.community_id;
    IF v_remaining_count = 0 THEN
      DELETE FROM public.communities WHERE id = OLD.community_id;
      RETURN OLD;
    END IF;

    SELECT user_id INTO v_next_owner
    FROM public.community_members
    WHERE community_id = OLD.community_id
    ORDER BY CASE WHEN role = 'admin' THEN 0 WHEN role = 'moderator' THEN 1 ELSE 2 END, joined_at ASC, user_id ASC
    LIMIT 1;

    IF v_next_owner IS NOT NULL THEN
      UPDATE public.communities SET owner_id = v_next_owner WHERE id = OLD.community_id;
      UPDATE public.community_members SET role = 'admin' WHERE community_id = OLD.community_id AND user_id = v_next_owner;
      INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, action_type, details)
      VALUES (OLD.community_id, OLD.user_id, v_next_owner, 'ownership_succession', jsonb_build_object('reason', 'owner_left'));
    END IF;
  END IF;
  RETURN OLD;
END $$;

CREATE OR REPLACE FUNCTION public.handle_profile_deletion_community_succession()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_community RECORD;
  v_next_owner uuid;
  v_remaining_count int;
BEGIN
  FOR v_community IN SELECT id FROM public.communities WHERE owner_id = OLD.id ORDER BY id FOR UPDATE LOOP
    SELECT count(*) INTO v_remaining_count
    FROM public.community_members WHERE community_id = v_community.id AND user_id <> OLD.id;

    IF v_remaining_count = 0 THEN
      DELETE FROM public.communities WHERE id = v_community.id;
      CONTINUE;
    END IF;

    SELECT user_id INTO v_next_owner
    FROM public.community_members
    WHERE community_id = v_community.id AND user_id <> OLD.id
    ORDER BY CASE WHEN role = 'admin' THEN 0 WHEN role = 'moderator' THEN 1 ELSE 2 END, joined_at ASC, user_id ASC
    LIMIT 1;

    IF v_next_owner IS NOT NULL THEN
      UPDATE public.communities SET owner_id = v_next_owner WHERE id = v_community.id;
      UPDATE public.community_members SET role = 'admin' WHERE community_id = v_community.id AND user_id = v_next_owner;
      INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, action_type, details)
      VALUES (v_community.id, NULL, v_next_owner, 'ownership_succession', jsonb_build_object('reason', 'account_deleted'));
    END IF;
  END LOOP;
  RETURN OLD;
END $$;

CREATE OR REPLACE FUNCTION public.create_community(p_name text, p_description text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_community_id uuid;
  v_general_id uuid;
  v_avisos_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN RAISE EXCEPTION 'Community name is required'; END IF;
  IF length(p_name) > 100 THEN RAISE EXCEPTION 'Community name must be 100 characters or less'; END IF;
  IF p_description IS NOT NULL AND length(p_description) > 500 THEN
    RAISE EXCEPTION 'Description must be 500 characters or less';
  END IF;

  INSERT INTO public.communities (name, description, owner_id)
  VALUES (trim(p_name), p_description, auth.uid())
  RETURNING id INTO v_community_id;

  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (v_community_id, auth.uid(), 'admin');

  INSERT INTO public.chats (type, status, name, community_id, created_by, write_policy, only_admins_can_send)
  VALUES ('community_chat', 'active', 'General', v_community_id, auth.uid(), 'all', false)
  RETURNING id INTO v_general_id;

  INSERT INTO public.chats (type, status, name, community_id, created_by, system_role, write_policy, only_admins_can_send)
  VALUES ('community_chat', 'active', 'Avisos', v_community_id, auth.uid(), 'announcements', 'admins', true)
  RETURNING id INTO v_avisos_id;

  INSERT INTO public.chat_members (chat_id, user_id, role)
  VALUES (v_general_id, auth.uid(), 'admin'), (v_avisos_id, auth.uid(), 'admin')
  ON CONFLICT DO NOTHING;

  RETURN v_community_id;
END $$;

DROP FUNCTION IF EXISTS public.create_community_chat(uuid, text, text, boolean);
CREATE FUNCTION public.create_community_chat(
  p_community_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_only_admins_can_send boolean DEFAULT false,
  p_write_policy text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_chat_id uuid;
  v_policy text := coalesce(p_write_policy, CASE WHEN coalesce(p_only_admins_can_send, false) THEN 'admins' ELSE 'all' END);
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_community_admin_or_owner(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only community admins can create chats' USING ERRCODE = '42501';
  END IF;
  IF v_policy NOT IN ('owner_only', 'admins', 'moderators', 'all') THEN
    RAISE EXCEPTION 'Invalid write policy';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN RAISE EXCEPTION 'Chat name is required'; END IF;
  IF length(p_name) > 100 THEN RAISE EXCEPTION 'Chat name must be 100 characters or less'; END IF;
  IF length(p_description) > 500 THEN RAISE EXCEPTION 'Description must be 500 characters or less'; END IF;

  INSERT INTO public.chats (
    type, status, name, description, community_id, created_by, write_policy, only_admins_can_send
  )
  VALUES (
    'community_chat', 'active', trim(p_name), p_description, p_community_id, auth.uid(), v_policy, (v_policy <> 'all')
  )
  RETURNING id INTO v_chat_id;

  INSERT INTO public.chat_members (chat_id, user_id, role)
  SELECT v_chat_id, cm.user_id, cm.role
  FROM public.community_members cm
  WHERE cm.community_id = p_community_id
  ON CONFLICT DO NOTHING;

  RETURN v_chat_id;
END $$;

CREATE OR REPLACE FUNCTION public.update_community_info(
  p_community_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_rank integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  v_rank := public.community_role_rank(p_community_id, auth.uid());
  IF v_rank < 2 THEN RAISE EXCEPTION 'Community staff required' USING ERRCODE = '42501'; END IF;
  IF v_rank < 3 AND (p_name IS NOT NULL OR p_avatar_url IS NOT NULL) THEN
    RAISE EXCEPTION 'Only community admins can update name or photo' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NOT NULL AND (length(btrim(p_name)) < 1 OR length(p_name) > 100) THEN
    RAISE EXCEPTION 'Name must be 1-100 characters';
  END IF;
  IF p_description IS NOT NULL AND length(p_description) > 500 THEN
    RAISE EXCEPTION 'Description must be 500 characters or less';
  END IF;
  IF p_avatar_url IS NOT NULL AND p_avatar_url <> '' AND (
    p_avatar_url !~ ('^community-' || p_community_id::text || '/community-[a-zA-Z0-9-]+\.webp$')
    OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'avatars' AND name = p_avatar_url)
  ) THEN
    RAISE EXCEPTION 'Community photo must be uploaded to this community';
  END IF;

  UPDATE public.communities
  SET name = COALESCE(btrim(p_name), name),
      description = COALESCE(p_description, description),
      avatar_url = CASE WHEN p_avatar_url IS NULL THEN avatar_url ELSE nullif(p_avatar_url, '') END,
      updated_at = now()
  WHERE id = p_community_id;
END $$;

CREATE OR REPLACE FUNCTION public.update_community_chat_info(
  p_chat_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_comm uuid;
  v_rank integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  SELECT community_id INTO v_comm FROM public.chats WHERE id = p_chat_id AND type = 'community_chat';
  IF NOT FOUND THEN RAISE EXCEPTION 'Community chat not found'; END IF;

  PERFORM 1 FROM public.communities WHERE id = v_comm FOR SHARE;
  PERFORM 1 FROM public.chats WHERE id = p_chat_id FOR UPDATE;
  v_rank := public.community_role_rank(v_comm, auth.uid());
  IF v_rank < 2 THEN RAISE EXCEPTION 'Community staff required' USING ERRCODE = '42501'; END IF;
  IF v_rank < 3 AND p_name IS NOT NULL THEN
    RAISE EXCEPTION 'Only community admins can rename chats' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NOT NULL AND (length(btrim(p_name)) < 1 OR length(p_name) > 100) THEN
    RAISE EXCEPTION 'Chat name must be 1-100 characters';
  END IF;
  IF p_description IS NOT NULL AND length(p_description) > 500 THEN
    RAISE EXCEPTION 'Description must be 500 characters or less';
  END IF;

  UPDATE public.chats
  SET name = COALESCE(btrim(p_name), name),
      description = COALESCE(p_description, description),
      updated_at = now()
  WHERE id = p_chat_id;
END $$;

CREATE OR REPLACE FUNCTION public.update_community_chat_write_policy(p_chat_id uuid, p_write_policy text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_comm uuid;
  v_sys text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  SELECT community_id, system_role INTO v_comm, v_sys
  FROM public.chats WHERE id = p_chat_id AND type = 'community_chat';
  IF NOT FOUND THEN RAISE EXCEPTION 'Community chat not found'; END IF;

  PERFORM 1 FROM public.communities WHERE id = v_comm FOR SHARE;
  PERFORM 1 FROM public.chats WHERE id = p_chat_id FOR UPDATE;
  IF NOT public.is_community_admin_or_owner(v_comm, auth.uid()) THEN
    RAISE EXCEPTION 'Only community admins can change write permissions' USING ERRCODE = '42501';
  END IF;
  IF v_sys = 'announcements' THEN
    RAISE EXCEPTION 'Official announcements permissions are managed via individual moderator grants';
  END IF;
  IF p_write_policy NOT IN ('owner_only', 'admins', 'moderators', 'all') THEN
    RAISE EXCEPTION 'Invalid write policy';
  END IF;

  UPDATE public.chats
  SET write_policy = p_write_policy,
      only_admins_can_send = (p_write_policy <> 'all'),
      updated_at = now()
  WHERE id = p_chat_id;

  INSERT INTO public.community_audit_logs (community_id, actor_id, target_chat_id, action_type, details)
  VALUES (v_comm, auth.uid(), p_chat_id, 'chat_write_policy_updated', jsonb_build_object('write_policy', p_write_policy));
END $$;

CREATE OR REPLACE FUNCTION public.delete_community_chat(p_chat_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_comm uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  SELECT community_id INTO v_comm FROM public.chats WHERE id = p_chat_id AND type = 'community_chat';
  IF NOT FOUND THEN RAISE EXCEPTION 'Community chat not found'; END IF;

  PERFORM 1 FROM public.communities WHERE id = v_comm FOR UPDATE;
  IF NOT public.is_community_admin_or_owner(v_comm, auth.uid()) THEN
    RAISE EXCEPTION 'Only community admins can delete chats' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.chats WHERE id = p_chat_id;
END $$;

CREATE OR REPLACE FUNCTION public.set_announcement_writer(p_community_id uuid, p_user_id uuid, p_grant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_announcements_chat uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR SHARE;
  SELECT id INTO v_announcements_chat
  FROM public.chats
  WHERE community_id = p_community_id AND system_role = 'announcements'
  FOR UPDATE;

  IF NOT public.is_community_admin_or_owner(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only community admins can manage announcement writers' USING ERRCODE = '42501';
  END IF;

  IF p_grant THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.community_members
      WHERE community_id = p_community_id AND user_id = p_user_id AND role = 'moderator'
    ) THEN
      RAISE EXCEPTION 'Announcement exceptions apply only to community moderators';
    END IF;
    INSERT INTO public.community_announcement_writers (community_id, user_id, granted_by)
    VALUES (p_community_id, p_user_id, auth.uid())
    ON CONFLICT (community_id, user_id) DO NOTHING;
  ELSE
    DELETE FROM public.community_announcement_writers
    WHERE community_id = p_community_id AND user_id = p_user_id;
  END IF;

  INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, target_chat_id, action_type, details)
  VALUES (
    p_community_id, auth.uid(), p_user_id, v_announcements_chat,
    CASE WHEN p_grant THEN 'announcement_writer_granted' ELSE 'announcement_writer_revoked' END,
    '{}'::jsonb
  );
END $$;

CREATE OR REPLACE FUNCTION public.promote_community_admin(p_community_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  IF public.community_role_rank(p_community_id, auth.uid()) < 4 THEN
    RAISE EXCEPTION 'Only the community owner can appoint admins' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.community_members WHERE community_id = p_community_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  UPDATE public.community_members SET role = 'admin' WHERE community_id = p_community_id AND user_id = p_user_id;
  INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, action_type)
  VALUES (p_community_id, auth.uid(), p_user_id, 'admin_appointed');
END $$;

CREATE OR REPLACE FUNCTION public.demote_community_admin(p_community_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  IF public.community_role_rank(p_community_id, auth.uid()) < 4 THEN
    RAISE EXCEPTION 'Only the community owner can remove admins' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.communities WHERE id = p_community_id AND owner_id = p_user_id) THEN
    RAISE EXCEPTION 'Cannot demote the community owner';
  END IF;
  UPDATE public.community_members SET role = 'member' WHERE community_id = p_community_id AND user_id = p_user_id AND role = 'admin';
  IF NOT FOUND THEN RAISE EXCEPTION 'Target is not an admin'; END IF;
  INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, action_type)
  VALUES (p_community_id, auth.uid(), p_user_id, 'admin_removed');
END $$;

CREATE OR REPLACE FUNCTION public.appoint_community_moderator(p_community_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_target_rank integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  IF NOT public.is_community_admin_or_owner(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Community admin required' USING ERRCODE = '42501';
  END IF;
  v_target_rank := public.community_role_rank(p_community_id, p_user_id);
  IF v_target_rank = 0 THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF v_target_rank >= 3 THEN RAISE EXCEPTION 'Cannot appoint an owner or admin as moderator'; END IF;
  UPDATE public.community_members SET role = 'moderator' WHERE community_id = p_community_id AND user_id = p_user_id;
  INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, action_type)
  VALUES (p_community_id, auth.uid(), p_user_id, 'moderator_appointed');
END $$;

CREATE OR REPLACE FUNCTION public.remove_community_moderator(p_community_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  PERFORM 1 FROM public.chats WHERE community_id = p_community_id ORDER BY id ASC FOR UPDATE;
  IF NOT public.is_community_admin_or_owner(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Community admin required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.community_members SET role = 'member'
  WHERE community_id = p_community_id AND user_id = p_user_id AND role = 'moderator';
  IF NOT FOUND THEN RAISE EXCEPTION 'Target is not a moderator'; END IF;
  DELETE FROM public.community_announcement_writers WHERE community_id = p_community_id AND user_id = p_user_id;
  INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, action_type)
  VALUES (p_community_id, auth.uid(), p_user_id, 'moderator_removed');
END $$;

CREATE OR REPLACE FUNCTION public.transfer_community_ownership(p_community_id uuid, p_new_owner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  IF public.community_role_rank(p_community_id, auth.uid()) < 4 THEN
    RAISE EXCEPTION 'Only the community owner can transfer ownership' USING ERRCODE = '42501';
  END IF;
  IF p_new_owner_id = auth.uid() THEN RETURN; END IF;
  -- OC-05: any current member may receive ownership
  IF NOT EXISTS (SELECT 1 FROM public.community_members WHERE community_id = p_community_id AND user_id = p_new_owner_id) THEN
    RAISE EXCEPTION 'Target must be a current community member';
  END IF;

  UPDATE public.communities SET owner_id = p_new_owner_id, updated_at = now() WHERE id = p_community_id;
  UPDATE public.community_members SET role = 'admin' WHERE community_id = p_community_id AND user_id IN (p_new_owner_id, auth.uid());

  INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, action_type)
  VALUES (p_community_id, auth.uid(), p_new_owner_id, 'ownership_transferred');
END $$;

CREATE OR REPLACE FUNCTION public.silence_community_member(
  p_community_id uuid,
  p_user_id uuid,
  p_silenced_until timestamptz,
  p_reason text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor_rank integer;
  v_target_rank integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  IF p_silenced_until IS NULL OR p_silenced_until <= now() THEN
    RAISE EXCEPTION 'Silence expiration must be in the future';
  END IF;
  IF p_reason IS NOT NULL AND length(p_reason) > 500 THEN
    RAISE EXCEPTION 'Reason must be 500 characters or less';
  END IF;

  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR SHARE;
  PERFORM 1 FROM public.community_members WHERE community_id = p_community_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  v_actor_rank := public.community_role_rank(p_community_id, auth.uid());
  v_target_rank := public.community_role_rank(p_community_id, p_user_id);
  IF v_actor_rank < 2 OR v_actor_rank <= v_target_rank OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to silence this member' USING ERRCODE = '42501';
  END IF;

  UPDATE public.community_members
  SET silenced_until = p_silenced_until, silenced_by = auth.uid(), silence_reason = nullif(btrim(p_reason), '')
  WHERE community_id = p_community_id AND user_id = p_user_id;

  INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, action_type, details, reason)
  VALUES (
    p_community_id, auth.uid(), p_user_id, 'member_silenced',
    jsonb_build_object('silenced_until', p_silenced_until),
    nullif(btrim(p_reason), '')
  );
END $$;

CREATE OR REPLACE FUNCTION public.unsilence_community_member(p_community_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor_rank integer;
  v_target_rank integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR SHARE;
  PERFORM 1 FROM public.community_members WHERE community_id = p_community_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  v_actor_rank := public.community_role_rank(p_community_id, auth.uid());
  v_target_rank := public.community_role_rank(p_community_id, p_user_id);
  IF v_actor_rank < 2 OR v_actor_rank <= v_target_rank THEN
    RAISE EXCEPTION 'Not authorized to lift silence for this member' USING ERRCODE = '42501';
  END IF;

  UPDATE public.community_members
  SET silenced_until = NULL, silenced_by = NULL, silence_reason = NULL
  WHERE community_id = p_community_id AND user_id = p_user_id;

  INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, action_type)
  VALUES (p_community_id, auth.uid(), p_user_id, 'member_unsilenced');
END $$;

CREATE OR REPLACE FUNCTION public.expel_community_member(
  p_community_id uuid,
  p_user_id uuid,
  p_reason text DEFAULT NULL,
  p_delete_messages boolean DEFAULT false
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor_rank integer;
  v_target_rank integer;
  v_deleted_count integer := 0;
  v_clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  IF length(v_clean_reason) > 500 THEN
    RAISE EXCEPTION 'Reason must be 500 characters or less';
  END IF;

  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  PERFORM 1 FROM public.chats WHERE community_id = p_community_id ORDER BY id ASC FOR UPDATE;
  PERFORM 1 FROM public.community_members WHERE community_id = p_community_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  v_actor_rank := public.community_role_rank(p_community_id, auth.uid());
  v_target_rank := public.community_role_rank(p_community_id, p_user_id);
  IF v_actor_rank < 2 OR v_actor_rank <= v_target_rank OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to expel this member' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.community_bans (community_id, user_id, banned_by, reason)
  VALUES (p_community_id, p_user_id, auth.uid(), v_clean_reason)
  ON CONFLICT (community_id, user_id) DO UPDATE
    SET banned_by = auth.uid(), reason = excluded.reason, created_at = now();

  IF coalesce(p_delete_messages, false) THEN
    UPDATE public.messages m
    SET deleted_at = now(), deleted_for_everyone = true
    FROM public.chats c
    WHERE m.chat_id = c.id
      AND c.community_id = p_community_id
      AND m.sender_id = p_user_id
      AND NOT m.deleted_for_everyone
      AND m.type <> 'system';
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  END IF;

  DELETE FROM public.community_members WHERE community_id = p_community_id AND user_id = p_user_id;

  INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, action_type, details, reason)
  VALUES (
    p_community_id, auth.uid(), p_user_id, 'member_expelled',
    jsonb_build_object('delete_messages', coalesce(p_delete_messages, false), 'deleted_count', v_deleted_count),
    v_clean_reason
  );
END $$;

CREATE OR REPLACE FUNCTION public.remove_community_member(p_community_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.expel_community_member(p_community_id, p_user_id, NULL, false);
END $$;

CREATE OR REPLACE FUNCTION public.unban_community_member(p_community_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  IF NOT public.is_community_admin_or_owner(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only community owner or admins can permit re-entry' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.community_bans WHERE community_id = p_community_id AND user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User is not blocked'; END IF;
  INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, action_type)
  VALUES (p_community_id, auth.uid(), p_user_id, 'member_unbanned');
END $$;

CREATE OR REPLACE FUNCTION public.moderate_delete_community_message(p_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_msg public.messages%ROWTYPE;
  v_comm uuid;
  v_actor_rank integer;
  v_target_rank integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  SELECT m.*, c.community_id INTO v_msg
  FROM public.messages m
  JOIN public.chats c ON c.id = m.chat_id
  WHERE m.id = p_message_id AND c.type = 'community_chat'
  FOR UPDATE OF m;

  IF NOT FOUND OR v_msg.deleted_for_everyone OR v_msg.type = 'system' THEN
    RAISE EXCEPTION 'Message unavailable';
  END IF;

  SELECT community_id INTO v_comm FROM public.chats WHERE id = v_msg.chat_id;
  PERFORM 1 FROM public.communities WHERE id = v_comm FOR SHARE;
  v_actor_rank := public.community_role_rank(v_comm, auth.uid());
  -- Departed authors have rank 0 -> any community staff (rank >= 2) may delete (OC-06)
  v_target_rank := CASE WHEN v_msg.sender_id IS NULL THEN 0 ELSE public.community_role_rank(v_comm, v_msg.sender_id) END;

  IF v_actor_rank < 2 THEN
    RAISE EXCEPTION 'Community staff required' USING ERRCODE = '42501';
  END IF;
  IF v_msg.sender_id <> auth.uid() AND v_target_rank >= v_actor_rank THEN
    RAISE EXCEPTION 'Not authorized to delete this author''s message' USING ERRCODE = '42501';
  END IF;

  UPDATE public.messages SET deleted_at = now(), deleted_for_everyone = true WHERE id = p_message_id;

  -- OC-07: audit log without copying deleted message content
  INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, target_chat_id, action_type, details)
  VALUES (
    v_comm, auth.uid(), v_msg.sender_id, v_msg.chat_id, 'message_deleted_by_staff',
    jsonb_build_object('message_id', p_message_id, 'author_departed', (v_target_rank = 0))
  );
END $$;

CREATE OR REPLACE FUNCTION public.join_community(p_community_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  IF NOT public.is_community_admin_or_owner(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Community admin required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.community_bans WHERE community_id = p_community_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'User is expelled from this community; unban first' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id)
    OR EXISTS (SELECT 1 FROM public.community_members WHERE community_id = p_community_id AND public.is_blocked_either_way(user_id, p_user_id)) THEN
    RAISE EXCEPTION 'Member unavailable';
  END IF;
  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (p_community_id, p_user_id, 'member') ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.join_community(p_community_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Community unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM public.community_bans WHERE community_id = p_community_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are blocked from rejoining this community' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (p_community_id, auth.uid(), 'member') ON CONFLICT DO NOTHING;
END $$;

-- Lock-ordered forward_chat_message (communities FOR SHARE -> chats FOR UPDATE -> community_members FOR SHARE)
CREATE OR REPLACE FUNCTION public.forward_chat_message(
  p_message_id uuid,
  p_chat_ids uuid[],
  p_message_ids uuid[]
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  source public.messages;
  target uuid;
  i integer;
  existing public.messages;
  v_chat public.chats%ROWTYPE;
  v_role public.chat_member_role;
BEGIN
  IF NOT public.can_access_chat_message(p_message_id) THEN
    RAISE EXCEPTION 'Message unavailable';
  END IF;
  IF cardinality(p_chat_ids) IS NULL OR cardinality(p_chat_ids) < 1 OR cardinality(p_chat_ids) > 5
    OR cardinality(p_message_ids) IS DISTINCT FROM cardinality(p_chat_ids)
    OR array_position(p_chat_ids, NULL) IS NOT NULL OR array_position(p_message_ids, NULL) IS NOT NULL
    OR (SELECT count(DISTINCT x) FROM unnest(p_chat_ids) x) <> cardinality(p_chat_ids)
    OR (SELECT count(DISTINCT x) FROM unnest(p_message_ids) x) <> cardinality(p_message_ids)
  THEN
    RAISE EXCEPTION 'Select between 1 and 5 distinct chats';
  END IF;

  -- Global lock order: communities -> chats -> community_members
  PERFORM 1
  FROM public.communities
  WHERE id IN (SELECT DISTINCT community_id FROM public.chats WHERE id = ANY(p_chat_ids) AND community_id IS NOT NULL)
  ORDER BY id ASC
  FOR SHARE;

  PERFORM 1 FROM public.chats WHERE id = ANY(p_chat_ids) ORDER BY id ASC FOR UPDATE;

  SELECT * INTO source
  FROM public.messages
  WHERE id = p_message_id AND NOT deleted_for_everyone AND type <> 'system'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Message unavailable'; END IF;

  FOR i IN 1..cardinality(p_chat_ids) LOOP
    target := p_chat_ids[i];
    SELECT c.* INTO v_chat FROM public.chats c WHERE c.id = target AND c.status = 'active';
    SELECT cm.role INTO v_role
    FROM public.chat_members cm
    WHERE cm.chat_id = target AND cm.user_id = auth.uid() AND cm.archived_at IS NULL;

    IF v_chat.id IS NULL OR v_role IS NULL THEN
      RAISE EXCEPTION 'Active unarchived chat membership required';
    END IF;
    IF v_chat.type = 'group' AND v_chat.only_admins_can_send AND NOT public.is_group_owner_or_admin(target, auth.uid()) THEN
      RAISE EXCEPTION 'Only admins can send messages in this chat' USING ERRCODE = '42501';
    END IF;
    IF v_chat.type = 'community_chat' THEN
      PERFORM 1 FROM public.community_members
      WHERE community_id = v_chat.community_id AND user_id = auth.uid() FOR SHARE;
      IF NOT public.can_write_community_chat(target, auth.uid()) THEN
        RAISE EXCEPTION 'Not allowed to send messages in this chat' USING ERRCODE = '42501';
      END IF;
    END IF;

    SELECT * INTO existing FROM public.messages WHERE id = p_message_ids[i];
    IF FOUND THEN
      IF existing.sender_id IS DISTINCT FROM auth.uid()
        OR existing.chat_id IS DISTINCT FROM target
        OR existing.forwarded_from_message_id IS DISTINCT FROM p_message_id
      THEN
        RAISE EXCEPTION 'Forward identifier already used';
      END IF;
    ELSE
      INSERT INTO public.messages (
        id, chat_id, sender_id, type, content, file_upload_id,
        media_thumbnail_upload_id, media_peaks, location_data,
        contact_data, forwarded_from_message_id
      )
      VALUES (
        p_message_ids[i], target, auth.uid(), source.type, source.content,
        source.file_upload_id, source.media_thumbnail_upload_id, source.media_peaks,
        source.location_data, source.contact_data, source.id
      );
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 10. FUNCTION OWNERSHIP & GRANTS
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'is_group_owner(uuid,uuid)', 'is_group_owner_or_admin(uuid,uuid)',
    'can_share_group_invite(uuid,uuid)', 'can_edit_group_info(uuid,uuid)', 'can_add_group_members(uuid,uuid)',
    'is_channel_staff(uuid,uuid)', 'community_role_rank(uuid,uuid)',
    'is_community_staff(uuid,uuid)', 'is_community_admin_or_owner(uuid,uuid)', 'can_write_community_chat(uuid,uuid)',
    'create_group_chat(text,uuid[],boolean,boolean,boolean,boolean,boolean)',
    'update_group_info(uuid,text,text,text,boolean,boolean,boolean,boolean,boolean)',
    'request_group_member_add(uuid,uuid[])', 'add_chat_members(uuid,uuid[])',
    'review_group_join_request(uuid,boolean)', 'get_group_invite(uuid)',
    'rotate_group_invite(uuid)', 'revoke_group_invite(uuid)', 'join_group_via_invite(text)',
    'promote_chat_admin(uuid,uuid)', 'demote_chat_admin(uuid,uuid)', 'remove_chat_member(uuid,uuid)',
    'transfer_group_ownership(uuid,uuid)',
    'create_channel(text,text,text,uuid)', 'get_channel_viewer_context(uuid)',
    'get_channel_staff(uuid)', 'get_channel_messages(uuid,timestamptz,uuid)',
    'appoint_channel_admin(uuid,uuid)', 'remove_channel_admin(uuid,uuid)',
    'transfer_channel_ownership(uuid,uuid)', 'delete_channel(uuid)', 'delete_channel_post(uuid)',
    'unfollow_channel(uuid)', 'follow_channel(uuid,uuid)',
    'send_channel_invitations(uuid,jsonb)', 'dismiss_channel_invitation(uuid)',
    'authorize_channel_post_media_read(uuid,uuid)', 'authorize_forwarded_channel_media_read(uuid,uuid)',
    'authorize_channel_avatar_read(uuid,text)',
    'can_access_chat_message(uuid,boolean)', 'set_message_reaction(uuid,text)',
    'create_community(text,text)', 'create_community_chat(uuid,text,text,boolean,text)',
    'update_community_info(uuid,text,text,text)', 'update_community_chat_info(uuid,text,text)',
    'update_community_chat_write_policy(uuid,text)', 'delete_community_chat(uuid)',
    'set_announcement_writer(uuid,uuid,boolean)',
    'promote_community_admin(uuid,uuid)', 'demote_community_admin(uuid,uuid)',
    'appoint_community_moderator(uuid,uuid)', 'remove_community_moderator(uuid,uuid)',
    'transfer_community_ownership(uuid,uuid)',
    'silence_community_member(uuid,uuid,timestamptz,text)', 'unsilence_community_member(uuid,uuid)',
    'expel_community_member(uuid,uuid,text,boolean)', 'remove_community_member(uuid,uuid)',
    'unban_community_member(uuid,uuid)', 'moderate_delete_community_message(uuid)',
    'join_community(uuid,uuid)', 'join_community(uuid)',
    'forward_chat_message(uuid,uuid[],uuid[])'
  ] LOOP
    EXECUTE 'ALTER FUNCTION public.' || fn || ' OWNER TO postgres';
    EXECUTE 'REVOKE ALL ON FUNCTION public.' || fn || ' FROM PUBLIC, anon, service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.' || fn || ' TO authenticated';
  END LOOP;

  FOREACH fn IN ARRAY ARRAY[
    'serialize_chat_message_write()', 'emit_channel_feed_event()',
    'handle_chat_member_delete()', 'handle_profile_deletion_channel_succession()',
    'sync_community_chat_roles()', 'handle_community_member_insert()',
    'handle_community_member_delete()', 'handle_profile_deletion_community_succession()'
  ] LOOP
    EXECUTE 'ALTER FUNCTION public.' || fn || ' OWNER TO postgres';
    EXECUTE 'REVOKE ALL ON FUNCTION public.' || fn || ' FROM PUBLIC, anon, authenticated, service_role';
  END LOOP;
END $$;

COMMIT;
