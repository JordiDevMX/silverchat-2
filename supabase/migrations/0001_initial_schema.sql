-- SilverChat: Prompt 04a. Supabase/Postgres 15+.
-- messages has exactly one scope: chat_id XOR channel_id. A third scope
-- requires revisiting this CHECK and every scope-based policy/trigger.
-- direct_pair_key = least(a::text,b::text)||'::'||greatest(a::text,b::text);
-- self chats use 'self::'||user_id::text. RPCs compute these server-side.
-- Keep chat_requests history: rejected_at plus historical responses enforce
-- the seven-day cooldown. Create file_uploads before referencing messages/stories.
-- The source enumerates 13 enums, despite the summary saying 14.
-- Storage design contract: all future SDK calls go through one storage adapter;
-- optimize images to WebP using app_config; use resumable/multipart uploads
-- above the configured threshold; no MVP server-side video transcoding.
-- Metadata remains independent of the storage provider. Buckets are private;
-- bucket provisioning is a later task, as specified by 04b-1 section 5.2.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.chat_type AS ENUM ('direct', 'group', 'self', 'community_chat');
CREATE TYPE public.chat_status AS ENUM ('active', 'pending_request', 'rejected');
CREATE TYPE public.chat_member_role AS ENUM ('admin', 'member');
CREATE TYPE public.message_type AS ENUM ('text', 'image', 'video', 'audio', 'file', 'sticker', 'location', 'contact', 'system');
CREATE TYPE public.call_type AS ENUM ('voice', 'video');
CREATE TYPE public.call_status AS ENUM ('ringing', 'answered', 'missed', 'declined', 'canceled', 'failed');
CREATE TYPE public.chat_request_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE public.report_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');
CREATE TYPE public.story_media_type AS ENUM ('image', 'video', 'text');
CREATE TYPE public.theme_preference AS ENUM ('light', 'dark', 'system');
CREATE TYPE public.accent_theme AS ENUM ('blue', 'purple', 'red', 'orange', 'yellow', 'green');
CREATE TYPE public.language_preference AS ENUM ('en', 'es');
CREATE TYPE public.upload_status AS ENUM ('pending', 'uploading', 'completed', 'failed', 'aborted');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL CHECK (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text NOT NULL,
  first_name text,
  last_name text,
  avatar_url text,
  bio text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_created_at ON public.profiles(created_at DESC);

CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme public.theme_preference NOT NULL DEFAULT 'system',
  accent public.accent_theme NOT NULL DEFAULT 'blue',
  language public.language_preference NOT NULL DEFAULT 'en',
  profile_photo_visibility text NOT NULL DEFAULT 'contacts'
    CHECK (profile_photo_visibility IN ('everyone', 'contacts', 'contacts_except', 'nobody')),
  profile_photo_exclusions uuid[] NOT NULL DEFAULT '{}'::uuid[],
  presence_visible boolean NOT NULL DEFAULT true,
  story_visibility text NOT NULL DEFAULT 'contacts'
    CHECK (story_visibility IN ('everyone', 'contacts', 'contacts_except', 'nobody')),
  story_exclusions uuid[] NOT NULL DEFAULT '{}'::uuid[],
  read_receipts_enabled boolean NOT NULL DEFAULT true,
  notifications_enabled boolean NOT NULL DEFAULT true,
  notification_sound_enabled boolean NOT NULL DEFAULT true,
  notification_previews_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_name text NOT NULL,
  device_type text NOT NULL DEFAULT 'web',
  user_agent text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  push_subscription jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_devices_user ON public.devices(user_id);
CREATE INDEX idx_devices_user_last_active ON public.devices(user_id, last_active_at DESC);

CREATE TABLE public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  avatar_url text,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  member_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_communities_owner ON public.communities(owner_id);

CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  avatar_url text,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_verified boolean NOT NULL DEFAULT false,
  follower_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_channels_owner ON public.channels(owner_id);
CREATE INDEX idx_channels_last_message_at ON public.channels(last_message_at DESC NULLS LAST);

CREATE TABLE public.file_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bucket text NOT NULL CHECK (bucket IN ('avatars', 'chat-media', 'story-media', 'channel-media')),
  path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  width integer,
  height integer,
  duration_seconds integer,
  hash_sha256 text,
  status public.upload_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(bucket, path)
);
CREATE INDEX idx_file_uploads_uploader ON public.file_uploads(uploader_id, created_at DESC);
CREATE INDEX idx_file_uploads_pending ON public.file_uploads(status) WHERE status = 'pending';
CREATE INDEX idx_file_uploads_hash ON public.file_uploads(hash_sha256) WHERE hash_sha256 IS NOT NULL;

CREATE TABLE public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.chat_type NOT NULL,
  status public.chat_status NOT NULL DEFAULT 'active',
  name text,
  description text,
  avatar_url text,
  community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE,
  direct_pair_key text UNIQUE,
  -- The circular FK to messages is attached after messages exists.
  last_message_id uuid,
  last_message_at timestamptz,
  last_message_preview text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (type != 'community_chat' OR community_id IS NOT NULL),
  CHECK (type != 'direct' OR direct_pair_key IS NOT NULL),
  CHECK (type != 'self' OR direct_pair_key IS NOT NULL)
);
CREATE INDEX idx_chats_last_message_at ON public.chats(last_message_at DESC NULLS LAST);
CREATE INDEX idx_chats_community ON public.chats(community_id) WHERE community_id IS NOT NULL;
CREATE INDEX idx_chats_status ON public.chats(status);

CREATE TABLE public.chat_members (
  chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.chat_member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  pinned_at timestamptz,
  favorited_at timestamptz,
  archived_at timestamptz,
  muted_until timestamptz,
  PRIMARY KEY(chat_id, user_id)
);
CREATE INDEX idx_chat_members_user ON public.chat_members(user_id, last_read_at DESC);
CREATE INDEX idx_chat_members_user_active ON public.chat_members(user_id, archived_at NULLS FIRST, last_read_at DESC);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type public.message_type NOT NULL DEFAULT 'text',
  content text,
  reply_to_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  file_upload_id uuid REFERENCES public.file_uploads(id) ON DELETE SET NULL,
  location_data jsonb,
  contact_data jsonb,
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_for_everyone boolean NOT NULL DEFAULT false,
  is_pinned_in_chat boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_exactly_one_scope CHECK ((chat_id IS NULL) <> (channel_id IS NULL))
);
ALTER TABLE public.chats ADD CONSTRAINT chats_last_message_id_fkey
  FOREIGN KEY(last_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;
CREATE INDEX idx_messages_chat ON public.messages(chat_id, created_at DESC) WHERE chat_id IS NOT NULL;
CREATE INDEX idx_messages_channel ON public.messages(channel_id, created_at DESC) WHERE channel_id IS NOT NULL;
CREATE INDEX idx_messages_sender ON public.messages(sender_id) WHERE sender_id IS NOT NULL;
CREATE INDEX idx_messages_reply ON public.messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
CREATE INDEX idx_messages_pinned ON public.messages(chat_id) WHERE is_pinned_in_chat = true;

CREATE TABLE public.message_receipts (
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  delivered_at timestamptz,
  read_at timestamptz,
  PRIMARY KEY(message_id, user_id)
);
CREATE INDEX idx_receipts_user_unread ON public.message_receipts(user_id) WHERE read_at IS NULL;

CREATE TABLE public.message_reactions (
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(message_id, user_id)
);
CREATE INDEX idx_reactions_message ON public.message_reactions(message_id);

CREATE TABLE public.message_deletions (
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(message_id, user_id)
);

CREATE TABLE public.chat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.chat_request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
CREATE INDEX idx_chat_requests_chat ON public.chat_requests(chat_id);
CREATE INDEX idx_chat_requests_recipient_pending ON public.chat_requests(recipient_id) WHERE status = 'pending';
CREATE INDEX idx_chat_requests_cooldown ON public.chat_requests(sender_id, recipient_id, responded_at DESC);

CREATE TABLE public.user_blocks (
  blocker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(blocker_id, blocked_id)
);
CREATE INDEX idx_user_blocks_blocked ON public.user_blocks(blocked_id);

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE,
  reported_message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  reason text NOT NULL,
  description text,
  status public.report_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX idx_reports_pending ON public.reports(status) WHERE status = 'pending';

CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_type public.story_media_type NOT NULL,
  file_upload_id uuid REFERENCES public.file_uploads(id) ON DELETE SET NULL,
  text_content text,
  background_color text,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX idx_stories_user_created ON public.stories(user_id, created_at DESC);
CREATE INDEX idx_stories_expires ON public.stories(expires_at);

CREATE TABLE public.story_views (
  story_id uuid REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(story_id, viewer_id)
);
CREATE INDEX idx_story_views_viewer ON public.story_views(viewer_id, viewed_at DESC);

CREATE TABLE public.channel_followers (
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  followed_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(channel_id, user_id)
);
CREATE INDEX idx_channel_followers_user ON public.channel_followers(user_id, last_read_at DESC);

CREATE TABLE public.community_members (
  community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.chat_member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(community_id, user_id)
);
CREATE INDEX idx_community_members_user ON public.community_members(user_id);

CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Correction: SET NULL must remain possible when the initiator deletes
  -- their account. INSERT RLS still requires initiator_id = auth.uid().
  initiator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  type public.call_type NOT NULL DEFAULT 'voice',
  status public.call_status NOT NULL DEFAULT 'ringing',
  livekit_room_name text UNIQUE NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer
);
CREATE INDEX idx_calls_initiator ON public.calls(initiator_id, started_at DESC);
CREATE INDEX idx_calls_chat ON public.calls(chat_id, started_at DESC);
CREATE INDEX idx_calls_ringing ON public.calls(status) WHERE status = 'ringing';

CREATE TABLE public.app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER user_settings_set_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER chats_set_updated_at BEFORE UPDATE ON public.chats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER channels_set_updated_at BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER communities_set_updated_at BEFORE UPDATE ON public.communities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER app_config_set_updated_at BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, username, display_name)
  VALUES (NEW.id, 'user_' || substr(NEW.id::text, 1, 8),
          COALESCE(NEW.raw_user_meta_data->>'display_name', 'New User'));
  INSERT INTO public.user_settings(user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.app_config(key, value, description) VALUES
  ('upload.max_bytes', '{"image":10485760,"video":104857600,"audio":20971520,"document":52428800}', 'Maximum upload size in bytes by media type'),
  ('upload.image_max_dimension', '{"value":2048}', 'Maximum optimized image dimension'),
  ('upload.image_quality', '{"value":0.82}', 'WebP compression quality'),
  ('upload.thumbnail_max_dimension', '{"value":512}', 'Maximum thumbnail dimension'),
  ('upload.multipart_threshold', '{"value":5242880}', 'Resumable/multipart upload threshold in bytes'),
  ('feature.stories_enabled', '{"value":true}', 'Stories feature flag'),
  ('feature.channels_enabled', '{"value":true}', 'Channels feature flag'),
  ('feature.communities_enabled', '{"value":true}', 'Communities feature flag'),
  ('feature.calls_enabled', '{"value":true}', 'Calls feature flag');

-- Deny by default even if 0001 is applied separately from the policy migration.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles','user_settings','devices','chats','chat_members','messages',
    'message_receipts','message_reactions','message_deletions','chat_requests',
    'user_blocks','reports','stories','story_views','channels','channel_followers',
    'communities','community_members','calls','file_uploads','app_config'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END;
$$;
