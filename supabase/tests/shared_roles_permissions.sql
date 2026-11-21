-- Real PostgreSQL / RLS / RPC authorization & privacy suite for Shared Roles & Permissions.
-- Pure PL/pgSQL inside BEGIN ... ROLLBACK so it runs identically in both:
--   1. `pnpm test:db supabase/tests/shared_roles_permissions.sql` (psql)
--   2. `npx supabase db query --linked -f supabase/tests/shared_roles_permissions.sql` (Staging API)
BEGIN;

CREATE FUNCTION pg_temp.assert_true(value boolean, message text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF value IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ASSERTION FAILED: %', message;
  END IF;
END $$;

CREATE FUNCTION pg_temp.rejects(statement text, expected text DEFAULT '') RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF expected <> '' AND position(expected IN SQLERRM) = 0 THEN
      RAISE EXCEPTION 'Unexpected error (expected "%"): %', expected, SQLERRM;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Expected statement to fail, but it succeeded: %', statement;
END $$;

CREATE FUNCTION pg_temp.act_as(p_user uuid, p_aal text DEFAULT 'aal1') RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated', 'aal', p_aal)::text,
    true
  );
END $$;

DO $$
DECLARE
  u_owner     uuid := 'f1111111-1111-4111-8111-111111111111';
  u_admin     uuid := 'f2222222-2222-4222-8222-222222222222';
  u_mod       uuid := 'f3333333-3333-4333-8333-333333333333';
  u_member    uuid := 'f4444444-4444-4444-8444-444444444444';
  u_member2   uuid := 'f5555555-5555-4555-8555-555555555555';
  u_outsider  uuid := 'f6666666-6666-4666-8666-666666666666';
  u_former    uuid := 'f7777777-7777-4777-8777-777777777777';

  v_grp_id    uuid;
  v_grp_tok   text;
  v_req_id    uuid;
  v_ch_id     uuid;
  v_ch_post   uuid;
  v_ch_up     uuid;
  v_ch_thumb  uuid;
  v_fwd_msg   uuid;
  v_dst_grp   uuid;
  v_inv_id    uuid;
  v_comm_id   uuid;
  v_gen_id    uuid;
  v_avisos_id uuid;
  v_ord_id    uuid;
  v_msg_id    uuid;
  v_dep_msg   uuid;
  v_adm_msg   uuid;
  v_cnt       bigint;
  v_str       text;
  v_uuid      uuid;
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    (u_owner,    'srp-owner@example.test',    '{"display_name":"Owner"}'),
    (u_admin,    'srp-admin@example.test',    '{"display_name":"Admin"}'),
    (u_mod,      'srp-mod@example.test',      '{"display_name":"Moderator"}'),
    (u_member,   'srp-member@example.test',   '{"display_name":"Member"}'),
    (u_member2,  'srp-member2@example.test',  '{"display_name":"Member2"}'),
    (u_outsider, 'srp-outsider@example.test', '{"display_name":"Outsider"}'),
    (u_former,   'srp-former@example.test',   '{"display_name":"Former"}');

  INSERT INTO storage.buckets (id, name, public) VALUES
    ('avatars', 'avatars', false),
    ('channel-media', 'channel-media', false)
  ON CONFLICT (id) DO NOTHING;

  -- Direct contact between u_member (ordinary follower) and u_owner (channel owner)
  PERFORM pg_temp.act_as(u_member);
  SET LOCAL ROLE authenticated;
  SELECT public.create_direct_chat_request(u_owner, 'Hi contact') INTO v_dst_grp;
  RESET ROLE;
  PERFORM pg_temp.act_as(u_owner);
  SET LOCAL ROLE authenticated;
  PERFORM public.accept_chat_request((SELECT id FROM public.chat_requests WHERE chat_id = v_dst_grp LIMIT 1));
  RESET ROLE;

  -- ═══════════════════════════════════════════════════════════════
  -- 1. GROUPS: roles, 5 permissions, OC-01, active membership, invites
  -- ═══════════════════════════════════════════════════════════════
  PERFORM pg_temp.act_as(u_owner);
  SET LOCAL ROLE authenticated;
  SELECT public.create_group_chat('SRP Group', ARRAY[u_admin, u_member, u_former]) INTO v_grp_id;

  -- Defaults independent of group size: all 4 open (false), approval off (false)
  PERFORM pg_temp.assert_true(
    (SELECT owner_id = u_owner
        AND NOT only_admins_can_add_members
        AND NOT only_admins_can_share_link
        AND NOT only_admins_can_send
        AND NOT only_admins_can_edit_info
        AND NOT require_admin_approval
     FROM public.chats WHERE id = v_grp_id),
    'New group defaults to open permissions and owner_id set'
  );

  -- Promote u_admin
  PERFORM public.promote_chat_admin(v_grp_id, u_admin);
  -- Remove u_former so u_former becomes a former member
  PERFORM public.remove_chat_member(v_grp_id, u_former);
  RESET ROLE;

  -- Raw PATCH on public.chats must be denied even for owner
  PERFORM pg_temp.act_as(u_owner);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.rejects(format('UPDATE public.chats SET name = ''Bypass'' WHERE id = %L', v_grp_id), 'permission denied');
  RESET ROLE;

  -- Outsider and former member denied on ALL open member-configurable actions (incl. avatar writes)
  PERFORM pg_temp.act_as(u_outsider);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.rejects(format('SELECT public.update_group_info(%L, ''Hacked'')', v_grp_id));
  PERFORM pg_temp.rejects(format('SELECT public.get_group_invite(%L)', v_grp_id));
  PERFORM pg_temp.rejects(format('SELECT public.add_chat_members(%L, ARRAY[%L::uuid])', v_grp_id, u_member2));
  PERFORM pg_temp.rejects(format('INSERT INTO storage.objects (bucket_id, name, owner) VALUES (''avatars'', %L, auth.uid())', 'chat-' || v_grp_id::text || '/group-outsider.webp'));
  RESET ROLE;

  PERFORM pg_temp.act_as(u_former);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.rejects(format('SELECT public.update_group_info(%L, ''HackedFormer'')', v_grp_id));
  PERFORM pg_temp.rejects(format('SELECT public.get_group_invite(%L)', v_grp_id));
  PERFORM pg_temp.rejects(format('SELECT public.add_chat_members(%L, ARRAY[%L::uuid])', v_grp_id, u_member2));
  PERFORM pg_temp.rejects(format('INSERT INTO storage.objects (bucket_id, name, owner) VALUES (''avatars'', %L, auth.uid())', 'chat-' || v_grp_id::text || '/group-former.webp'));
  RESET ROLE;

  -- Ordinary member CAN edit info, upload avatar, share invite (NOT rotate/revoke), and add directly when open
  PERFORM pg_temp.act_as(u_member);
  SET LOCAL ROLE authenticated;
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('avatars', 'chat-' || v_grp_id::text || '/group-m1.webp', auth.uid());
  PERFORM public.update_group_info(v_grp_id, 'Renamed by Member', 'Member desc', 'chat-' || v_grp_id::text || '/group-m1.webp');
  SELECT public.get_group_invite(v_grp_id) INTO v_grp_tok;
  PERFORM pg_temp.assert_true(v_grp_tok IS NOT NULL AND length(v_grp_tok) >= 16, 'Member can read/share active invite when open');
  PERFORM pg_temp.rejects(format('SELECT public.rotate_group_invite(%L)', v_grp_id));
  PERFORM pg_temp.rejects(format('SELECT public.revoke_group_invite(%L)', v_grp_id));
  -- Member cannot toggle permissions
  PERFORM pg_temp.rejects(format('SELECT public.update_group_info(%L, NULL, NULL, NULL, true)', v_grp_id));
  RESET ROLE;

  -- Enable require_admin_approval; ordinary member add creates pending request; Link/QR and admin add directly
  PERFORM pg_temp.act_as(u_admin);
  SET LOCAL ROLE authenticated;
  PERFORM public.update_group_info(v_grp_id, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true);
  -- OC-01: admin CANNOT demote or remove another admin or owner
  PERFORM pg_temp.rejects(format('SELECT public.demote_chat_admin(%L, %L)', v_grp_id, u_owner));
  PERFORM pg_temp.rejects(format('SELECT public.remove_chat_member(%L, %L)', v_grp_id, u_owner));
  PERFORM public.promote_chat_admin(v_grp_id, u_member);
  PERFORM pg_temp.rejects(format('SELECT public.demote_chat_admin(%L, %L)', v_grp_id, u_member));
  PERFORM pg_temp.rejects(format('SELECT public.remove_chat_member(%L, %L)', v_grp_id, u_member));
  RESET ROLE;

  PERFORM pg_temp.act_as(u_owner);
  SET LOCAL ROLE authenticated;
  PERFORM public.demote_chat_admin(v_grp_id, u_member);
  RESET ROLE;

  PERFORM pg_temp.act_as(u_member);
  SET LOCAL ROLE authenticated;
  PERFORM public.request_group_member_add(v_grp_id, ARRAY[u_member2]);
  PERFORM pg_temp.assert_true(NOT public.is_chat_member(v_grp_id, u_member2), 'Approval ON defers ordinary member add');
  SELECT id INTO v_req_id FROM public.group_join_requests WHERE chat_id = v_grp_id AND target_user_id = u_member2 AND status = 'pending';
  PERFORM pg_temp.assert_true(v_req_id IS NOT NULL, 'Pending join request created');
  RESET ROLE;

  -- Link/QR admits directly even with require_admin_approval = true
  PERFORM pg_temp.act_as(u_outsider);
  SET LOCAL ROLE authenticated;
  PERFORM public.join_group_via_invite(v_grp_tok);
  PERFORM pg_temp.assert_true(public.is_chat_member(v_grp_id, u_outsider), 'Link/QR admits directly despite approval=true');
  RESET ROLE;

  -- Restrict sharing invite -> ordinary member cannot read token
  PERFORM pg_temp.act_as(u_owner);
  SET LOCAL ROLE authenticated;
  PERFORM public.update_group_info(v_grp_id, NULL, NULL, NULL, NULL, NULL, true);
  PERFORM public.rotate_group_invite(v_grp_id);
  RESET ROLE;

  PERFORM pg_temp.act_as(u_member);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.rejects(format('SELECT public.get_group_invite(%L)', v_grp_id));
  SELECT count(*) INTO v_cnt FROM public.chat_invite_links WHERE chat_id = v_grp_id;
  PERFORM pg_temp.assert_true(v_cnt = 0, 'Restricted member cannot raw-select chat_invite_links');
  RESET ROLE;

  -- ═══════════════════════════════════════════════════════════════
  -- 2. CHANNELS: OC-02, OC-03, OC-04, privacy, forwarded media, retry
  -- ═══════════════════════════════════════════════════════════════
  v_ch_id := 'faaaaa11-1111-4111-8111-111111111111';
  PERFORM pg_temp.act_as(u_owner);
  SET LOCAL ROLE authenticated;
  SELECT public.create_channel('Tech News', 'tech-news-srp', 'Desc', v_ch_id) INTO v_uuid;
  PERFORM pg_temp.assert_true(v_uuid = v_ch_id, 'create_channel uses client UUID');
  -- Lost-response idempotent retry returns same channel without duplicate or slug error
  SELECT public.create_channel('Tech News', 'tech-news-srp', 'Desc', v_ch_id) INTO v_uuid;
  PERFORM pg_temp.assert_true(v_uuid = v_ch_id, 'create_channel retry is idempotent');

  -- Appoint u_admin; OC-02 follower count = 2 (owner + admin, once each); neither can unfollow while in office
  PERFORM public.appoint_channel_admin(v_ch_id, u_admin);
  PERFORM pg_temp.assert_true((SELECT follower_count = 2 FROM public.channels_public WHERE id = v_ch_id), 'Owner + admin counted once each in follower_count');
  PERFORM pg_temp.rejects(format('SELECT public.unfollow_channel(%L)', v_ch_id));

  -- Upload channel avatar & media
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('avatars', 'chat-' || v_ch_id::text || '/channel-1.webp', auth.uid());
  PERFORM public.update_channel_info(v_ch_id, NULL, NULL, NULL, 'chat-' || v_ch_id::text || '/channel-1.webp');
  INSERT INTO public.file_uploads (uploader_id, bucket, path, original_filename, mime_type, size_bytes)
  VALUES (auth.uid(), 'channel-media', v_ch_id::text || '/att1.webp', 'att1.webp', 'image/webp', 100) RETURNING id INTO v_ch_up;
  INSERT INTO public.file_uploads (uploader_id, bucket, path, original_filename, mime_type, size_bytes)
  VALUES (auth.uid(), 'channel-media', v_ch_id::text || '/thumb1.webp', 'thumb1.webp', 'image/webp', 50) RETURNING id INTO v_ch_thumb;
  UPDATE public.file_uploads SET status = 'completed', completed_at = now() WHERE id IN (v_ch_up, v_ch_thumb);
  INSERT INTO storage.objects (bucket_id, name, owner) SELECT bucket, path, uploader_id FROM public.file_uploads WHERE id IN (v_ch_up, v_ch_thumb);
  INSERT INTO public.messages (channel_id, sender_id, type, content, file_upload_id, media_thumbnail_upload_id)
  VALUES (v_ch_id, auth.uid(), 'video', 'Owner broadcast', v_ch_up, v_ch_thumb) RETURNING id INTO v_ch_post;
  RESET ROLE;

  -- Channel admin: cannot unfollow, cannot edit channel info, cannot delete owner post, CAN publish own post & CAN report channel (OC-03, OC-04)
  PERFORM pg_temp.act_as(u_admin);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.rejects(format('SELECT public.unfollow_channel(%L)', v_ch_id));
  PERFORM pg_temp.rejects(format('SELECT public.update_channel_info(%L, ''Hijacked'')', v_ch_id));
  PERFORM pg_temp.rejects(format('SELECT public.delete_channel_post(%L)', v_ch_post));
  INSERT INTO public.messages (channel_id, sender_id, type, content) VALUES (v_ch_id, auth.uid(), 'text', 'Admin post');
  INSERT INTO public.reports (reporter_id, reported_channel_id, reason, description)
  VALUES (auth.uid(), v_ch_id, 'inappropriate', 'Admin reports channel');
  -- Staff CANNOT see follower identities in channel_followers
  SELECT count(*) INTO v_cnt FROM public.channel_followers WHERE channel_id = v_ch_id;
  PERFORM pg_temp.assert_true(v_cnt = 1, 'Staff only sees own channel_followers row');
  RESET ROLE;

  -- Follower/Visitor privacy & reaction removal
  PERFORM pg_temp.act_as(u_member);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.channels WHERE id = v_ch_id;
  PERFORM pg_temp.assert_true(v_cnt = 0, 'Non-staff cannot raw-select public.channels');
  SELECT count(*) INTO v_cnt FROM public.channel_staff WHERE channel_id = v_ch_id;
  PERFORM pg_temp.assert_true(v_cnt = 0, 'Non-staff cannot raw-select channel_staff');
  SELECT count(*) INTO v_cnt FROM public.messages WHERE channel_id = v_ch_id;
  PERFORM pg_temp.assert_true(v_cnt = 0, 'Non-staff cannot raw-select channel messages / Realtime');
  SELECT count(*) INTO v_cnt FROM public.file_uploads WHERE id IN (v_ch_up, v_ch_thumb);
  PERFORM pg_temp.assert_true(v_cnt = 0, 'Non-staff cannot raw-select channel file_uploads');
  SELECT count(*) INTO v_cnt FROM storage.objects WHERE bucket_id = 'channel-media' AND name LIKE v_ch_id::text || '/%';
  PERFORM pg_temp.assert_true(v_cnt = 0, 'Non-staff cannot raw-select channel-media storage.objects');
  -- get_channel_messages forces sender_id = NULL
  PERFORM pg_temp.assert_true(
    (SELECT count(*) = 2 AND bool_and(sender_id IS NULL) FROM public.get_channel_messages(v_ch_id)),
    'Non-staff reads channel posts with NULL sender_id'
  );
  -- Avatar signing authorization bound to current channel avatar_url
  PERFORM pg_temp.assert_true(
    (SELECT path = 'chat-' || v_ch_id::text || '/channel-1.webp' FROM public.authorize_channel_avatar_read(v_ch_id, 'chat-' || v_ch_id::text || '/channel-1.webp')),
    'Non-staff can authorize current channel avatar'
  );
  PERFORM pg_temp.rejects(format('SELECT * FROM public.authorize_channel_avatar_read(%L, %L)', v_ch_id, 'chat-' || v_ch_id::text || '/channel-old.webp'));
  -- Non-staff (member & visitor) can report discoverable channel without leaking owner
  INSERT INTO public.reports (reporter_id, reported_channel_id, reason, description)
  VALUES (auth.uid(), v_ch_id, 'spam', 'Follower reports channel');
  -- Visitor cannot send channel invitations
  PERFORM pg_temp.rejects(format('SELECT public.send_channel_invitations(%L, %L::jsonb)', v_ch_id, json_build_array(json_build_object('id', gen_random_uuid(), 'recipient_id', u_owner))::text));
  -- Follow channel independently; reactions disabled for followers
  PERFORM public.follow_channel(v_ch_id);
  PERFORM pg_temp.rejects(format('SELECT public.set_message_reaction(%L, ''👍'')', v_ch_post));

  -- Ordinary follower invites staff contact (u_owner) without leaking follower/staff status
  v_inv_id := 'fb111111-1111-4111-8111-111111111111';
  PERFORM public.send_channel_invitations(v_ch_id, json_build_array(json_build_object('id', v_inv_id, 'recipient_id', u_owner))::jsonb);
  -- Retry same invitation ID does not duplicate
  PERFORM public.send_channel_invitations(v_ch_id, json_build_array(json_build_object('id', v_inv_id, 'recipient_id', u_owner))::jsonb);
  PERFORM pg_temp.assert_true((SELECT status = 'pending' FROM public.channel_invitations_sent WHERE id = v_inv_id), 'Invitation stays pending even when recipient is already staff');
  RESET ROLE;

  -- Staff recipient (u_owner) sees channel-attributed invite WITHOUT personal sender_id/name; private dismissal keeps sender view 'pending'
  PERFORM pg_temp.act_as(u_owner);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.assert_true(
    (SELECT count(*) = 1 FROM public.channel_invitations_received WHERE id = v_inv_id AND channel_id = v_ch_id),
    'Recipient receives channel-attributed invitation'
  );
  PERFORM public.dismiss_channel_invitation(v_inv_id);
  SELECT count(*) INTO v_cnt FROM public.channel_invitations_received WHERE id = v_inv_id;
  PERFORM pg_temp.assert_true(v_cnt = 0, 'Dismissed invitation disappears for recipient');
  RESET ROLE;

  PERFORM pg_temp.act_as(u_member);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.assert_true((SELECT status = 'pending' FROM public.channel_invitations_sent WHERE id = v_inv_id), 'Private dismissal still shows pending to sender');
  -- Forward channel post to destination group (u_member & u_member2)
  v_fwd_msg := 'fc111111-1111-4111-8111-111111111111';
  PERFORM public.forward_chat_message(v_ch_post, ARRAY[v_grp_id], ARRAY[v_fwd_msg]);
  RESET ROLE;

  -- Non-staff destination member views forwarded media metadata without uploader_id; unrelated outsider denied on forwarded_chat
  PERFORM pg_temp.act_as(u_member2);
  SET LOCAL ROLE authenticated;
  -- Add u_member2 via admin approval first so u_member2 is in destination group
  RESET ROLE;
  PERFORM pg_temp.act_as(u_owner);
  SET LOCAL ROLE authenticated;
  PERFORM public.review_group_join_request(v_req_id, true);
  RESET ROLE;

  PERFORM pg_temp.act_as(u_member2);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.file_uploads WHERE id IN (v_ch_up, v_ch_thumb);
  PERFORM pg_temp.assert_true(v_cnt = 0, 'Destination member cannot raw-select channel file_uploads uploader_id');
  PERFORM pg_temp.assert_true((SELECT count(*) = 2 FROM public.message_media_public WHERE id IN (v_ch_up, v_ch_thumb)), 'Destination member reads public media projection without uploader_id');
  PERFORM pg_temp.assert_true((SELECT path = v_ch_id::text || '/att1.webp' FROM public.authorize_forwarded_channel_media_read(v_ch_up, v_fwd_msg)), 'Destination member authorizes forwarded attachment');
  PERFORM pg_temp.assert_true((SELECT path = v_ch_id::text || '/thumb1.webp' FROM public.authorize_forwarded_channel_media_read(v_ch_thumb, v_fwd_msg)), 'Destination member authorizes forwarded thumbnail');
  RESET ROLE;

  PERFORM pg_temp.act_as(u_former);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.rejects(format('SELECT * FROM public.authorize_forwarded_channel_media_read(%L, %L)', v_ch_up, v_fwd_msg));
  -- Delete original channel post -> unrelated u_former denied on BOTH channel_post and forwarded_chat while destination u_member2 still authorized
  RESET ROLE;
  PERFORM pg_temp.act_as(u_owner);
  SET LOCAL ROLE authenticated;
  PERFORM public.delete_channel_post(v_ch_post);
  RESET ROLE;

  PERFORM pg_temp.act_as(u_former);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.rejects(format('SELECT * FROM public.authorize_channel_post_media_read(%L, %L)', v_ch_up, v_ch_id));
  PERFORM pg_temp.rejects(format('SELECT * FROM public.authorize_forwarded_channel_media_read(%L, %L)', v_ch_up, v_fwd_msg));
  RESET ROLE;

  PERFORM pg_temp.act_as(u_member2);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.assert_true((SELECT path = v_ch_id::text || '/att1.webp' FROM public.authorize_forwarded_channel_media_read(v_ch_up, v_fwd_msg)), 'Destination member still accesses forwarded copy after source deleted');
  RESET ROLE;

  -- ═══════════════════════════════════════════════════════════════
  -- 3. COMMUNITIES: General + Avisos, moderator, silence, bans, audit, succession
  -- ═══════════════════════════════════════════════════════════════
  PERFORM pg_temp.act_as(u_owner);
  SET LOCAL ROLE authenticated;
  SELECT public.create_community('SRP Community', 'Desc') INTO v_comm_id;
  SELECT id INTO v_gen_id FROM public.chats WHERE community_id = v_comm_id AND name = 'General';
  SELECT id INTO v_avisos_id FROM public.chats WHERE community_id = v_comm_id AND system_role = 'announcements';
  PERFORM pg_temp.assert_true(v_gen_id IS NOT NULL AND v_avisos_id IS NOT NULL, 'create_community creates General and official announcements');
  PERFORM pg_temp.assert_true((SELECT write_policy = 'all' FROM public.chats WHERE id = v_gen_id), 'General starts open');
  PERFORM pg_temp.assert_true((SELECT write_policy = 'admins' FROM public.chats WHERE id = v_avisos_id), 'Official announcements starts restricted');

  -- Rename announcements preserves system_role; new chat named Avisos uses ordinary rules
  PERFORM public.update_community_chat_info(v_avisos_id, 'Official News', NULL);
  PERFORM pg_temp.assert_true((SELECT system_role = 'announcements' FROM public.chats WHERE id = v_avisos_id), 'Official identity survives rename');
  SELECT public.create_community_chat(v_comm_id, 'Avisos', 'User chat') INTO v_ord_id;
  PERFORM pg_temp.assert_true((SELECT system_role IS NULL AND write_policy = 'all' FROM public.chats WHERE id = v_ord_id), 'Later chat named Avisos uses ordinary rules');

  -- Add members and set roles
  PERFORM public.join_community(v_comm_id, u_admin);
  PERFORM public.join_community(v_comm_id, u_mod);
  PERFORM public.join_community(v_comm_id, u_member);
  PERFORM public.join_community(v_comm_id, u_former);
  PERFORM public.promote_community_admin(v_comm_id, u_admin);
  PERFORM public.appoint_community_moderator(v_comm_id, u_mod);
  -- Grant moderator announcement exception
  PERFORM public.set_announcement_writer(v_comm_id, u_mod, true);
  RESET ROLE;

  -- Seed active admin message + soon-to-depart message
  PERFORM pg_temp.act_as(u_admin);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.messages (chat_id, sender_id, content) VALUES (v_gen_id, u_admin, 'Admin msg') RETURNING id INTO v_adm_msg;
  RESET ROLE;

  PERFORM pg_temp.act_as(u_former);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.messages (chat_id, sender_id, content) VALUES (v_gen_id, u_former, 'Departed msg') RETURNING id INTO v_dep_msg;
  PERFORM public.leave_community(v_comm_id);
  RESET ROLE;

  -- Moderator permissions: edits community & child descriptions (not names), writes in announcements, deletes member & departed messages (NOT active admin)
  PERFORM pg_temp.act_as(u_mod);
  SET LOCAL ROLE authenticated;
  PERFORM public.update_community_info(v_comm_id, NULL, 'Mod updated community desc');
  PERFORM public.update_community_chat_info(v_gen_id, NULL, 'Mod updated chat desc');
  PERFORM pg_temp.rejects(format('SELECT public.update_community_info(%L, ''New Name'')', v_comm_id));
  PERFORM pg_temp.rejects(format('SELECT public.update_community_chat_info(%L, ''New Chat Name'')', v_gen_id));
  INSERT INTO public.messages (chat_id, sender_id, content) VALUES (v_avisos_id, u_mod, 'Mod announcement');
  PERFORM public.moderate_delete_community_message(v_dep_msg);
  PERFORM pg_temp.rejects(format('SELECT public.moderate_delete_community_message(%L)', v_adm_msg));
  -- Silence member; expel member? Wait: silence member then lift; admin cannot lift after member promoted to mod unless authorized
  PERFORM public.silence_community_member(v_comm_id, u_member, now() + interval '1 hour', 'Spam');
  RESET ROLE;

  PERFORM pg_temp.act_as(u_member);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.rejects(format('INSERT INTO public.messages (chat_id, sender_id, content) VALUES (%L, auth.uid(), ''Silenced'')', v_gen_id));
  SELECT count(*) INTO v_cnt FROM public.community_audit_logs WHERE community_id = v_comm_id;
  PERFORM pg_temp.assert_true(v_cnt = 0, 'Ordinary member cannot read audit logs');
  SELECT count(*) INTO v_cnt FROM public.community_bans WHERE community_id = v_comm_id;
  PERFORM pg_temp.assert_true(v_cnt = 0, 'Ordinary member cannot read blocked list');
  RESET ROLE;

  -- Removing moderator clears announcement grant
  PERFORM pg_temp.act_as(u_admin);
  SET LOCAL ROLE authenticated;
  PERFORM public.remove_community_moderator(v_comm_id, u_mod);
  PERFORM public.appoint_community_moderator(v_comm_id, u_mod);
  RESET ROLE;

  PERFORM pg_temp.act_as(u_mod);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.rejects(format('INSERT INTO public.messages (chat_id, sender_id, content) VALUES (%L, auth.uid(), ''No grant'')', v_avisos_id));
  -- Expel u_member with reason and bulk delete = false
  PERFORM public.expel_community_member(v_comm_id, u_member, 'Rule violation', false);
  -- Moderator can read blocked list (read-only) but CANNOT unban (OC-06)
  SELECT count(*) INTO v_cnt FROM public.community_bans WHERE community_id = v_comm_id AND user_id = u_member;
  PERFORM pg_temp.assert_true(v_cnt = 1, 'Moderator has read-only access to blocked list');
  PERFORM pg_temp.rejects(format('SELECT public.unban_community_member(%L, %L)', v_comm_id, u_member));
  -- Audit log readable by staff, never copies deleted message content
  SELECT count(*) INTO v_cnt FROM public.community_audit_logs WHERE community_id = v_comm_id;
  PERFORM pg_temp.assert_true(v_cnt >= 5, 'Staff reads community audit log');
  RESET ROLE;

  -- Banned user cannot rejoin until owner/admin unbans; rejoin grants ordinary member
  PERFORM pg_temp.act_as(u_member);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.rejects(format('SELECT public.join_community(%L)', v_comm_id));
  RESET ROLE;

  PERFORM pg_temp.act_as(u_admin);
  SET LOCAL ROLE authenticated;
  PERFORM public.unban_community_member(v_comm_id, u_member);
  RESET ROLE;

  PERFORM pg_temp.act_as(u_member);
  SET LOCAL ROLE authenticated;
  PERFORM public.join_community(v_comm_id);
  PERFORM pg_temp.assert_true((SELECT role = 'member' FROM public.community_members WHERE community_id = v_comm_id AND user_id = u_member), 'Rejoining after unban gives ordinary member role');
  RESET ROLE;

  -- OC-05: Owner transfers community ownership to ordinary member; outgoing becomes admin
  PERFORM pg_temp.act_as(u_owner);
  SET LOCAL ROLE authenticated;
  PERFORM public.transfer_community_ownership(v_comm_id, u_member);
  PERFORM pg_temp.assert_true(
    (SELECT owner_id = u_member FROM public.communities WHERE id = v_comm_id)
    AND (SELECT role = 'admin' FROM public.community_members WHERE community_id = v_comm_id AND user_id = u_owner),
    'Community ownership transfers to any member and outgoing owner becomes admin'
  );
  RESET ROLE;

  -- Finding 1 & Finding 2 audit checks:
  -- Cross-user identity probe via public predicate RPCs returns false / 0 for other subjects
  PERFORM pg_temp.act_as(u_outsider);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.assert_true(NOT public.is_channel_staff(v_ch_id, u_owner), 'Outsider cannot probe channel owner via is_channel_staff');
  PERFORM pg_temp.assert_true(NOT public.is_channel_staff(v_ch_id, u_admin), 'Outsider cannot probe channel admin via is_channel_staff');
  PERFORM pg_temp.assert_true(NOT public.is_channel_owner(v_ch_id, u_owner), 'Outsider cannot probe channel owner via is_channel_owner');
  PERFORM pg_temp.assert_true(NOT public.is_channel_follower(v_ch_id, u_member), 'Outsider cannot probe channel follower via is_channel_follower');
  PERFORM pg_temp.assert_true(NOT public.is_group_owner_or_admin(v_grp_id, u_owner), 'Outsider cannot probe group admin via is_group_owner_or_admin');
  PERFORM pg_temp.assert_true(public.community_role_rank(v_comm_id, u_member) = 0, 'Outsider cannot probe community role rank');
  PERFORM pg_temp.rejects('SELECT private.is_channel_staff(' || quote_literal(v_ch_id) || ', ' || quote_literal(u_owner) || ')');
  RESET ROLE;

  PERFORM pg_temp.act_as(u_admin);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.assert_true(public.is_channel_staff(v_ch_id, u_admin), 'Caller can evaluate own channel staff membership');
  PERFORM pg_temp.assert_true(NOT public.is_channel_owner(v_ch_id, u_owner), 'Admin cannot probe distinct channel owner ID');
  -- Direct DELETE from channel_followers as staff deletes 0 rows and keeps follower_count intact
  SELECT follower_count INTO v_cnt FROM public.channels_public WHERE id = v_ch_id;
  DELETE FROM public.channel_followers WHERE channel_id = v_ch_id AND user_id = auth.uid();
  PERFORM pg_temp.assert_true(
    (SELECT follower_count = v_cnt FROM public.channels_public WHERE id = v_ch_id)
    AND EXISTS (SELECT 1 FROM public.channel_followers WHERE channel_id = v_ch_id AND user_id = u_admin),
    'Channel admin cannot delete own channel_followers row directly or skew follower_count'
  );
  RESET ROLE;

  PERFORM pg_temp.act_as(u_owner);
  SET LOCAL ROLE authenticated;
  DELETE FROM public.channel_followers WHERE channel_id = v_ch_id AND user_id = auth.uid();
  PERFORM pg_temp.assert_true(
    (SELECT follower_count = v_cnt FROM public.channels_public WHERE id = v_ch_id)
    AND EXISTS (SELECT 1 FROM public.channel_followers WHERE channel_id = v_ch_id AND user_id = u_owner),
    'Channel owner cannot delete own channel_followers row directly or skew follower_count'
  );
  RESET ROLE;

  -- Trigger layer also rejects direct DELETE even when bypassing RLS
  PERFORM pg_temp.rejects(
    'DELETE FROM public.channel_followers WHERE channel_id = ' || quote_literal(v_ch_id) || ' AND user_id = ' || quote_literal(u_admin),
    'Channel staff cannot unfollow while in office'
  );
END $$;

ROLLBACK;
