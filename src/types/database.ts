export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      app_config: {
        Row: {
          description: string | null;
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          description?: string | null;
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          description?: string | null;
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      calls: {
        Row: {
          answered_at: string | null;
          chat_id: string;
          decline_reason: string | null;
          duration_seconds: number | null;
          ended_at: string | null;
          ended_reason: string | null;
          id: string;
          initiator_id: string | null;
          livekit_room_name: string;
          started_at: string;
          status: Database["public"]["Enums"]["call_status"];
          type: Database["public"]["Enums"]["call_type"];
        };
        Insert: {
          answered_at?: string | null;
          chat_id: string;
          decline_reason?: string | null;
          duration_seconds?: number | null;
          ended_at?: string | null;
          ended_reason?: string | null;
          id?: string;
          initiator_id?: string | null;
          livekit_room_name: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["call_status"];
          type?: Database["public"]["Enums"]["call_type"];
        };
        Update: {
          answered_at?: string | null;
          chat_id?: string;
          decline_reason?: string | null;
          duration_seconds?: number | null;
          ended_at?: string | null;
          ended_reason?: string | null;
          id?: string;
          initiator_id?: string | null;
          livekit_room_name?: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["call_status"];
          type?: Database["public"]["Enums"]["call_type"];
        };
        Relationships: [
          {
            foreignKeyName: "calls_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calls_initiator_id_fkey";
            columns: ["initiator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calls_initiator_id_fkey";
            columns: ["initiator_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calls_initiator_id_fkey";
            columns: ["initiator_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      channel_feed_events: {
        Row: {
          channel_id: string;
          created_at: string;
          event_type: string;
          id: string;
          message_id: string;
        };
        Insert: {
          channel_id: string;
          created_at?: string;
          event_type: string;
          id?: string;
          message_id: string;
        };
        Update: {
          channel_id?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          message_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "channel_feed_events_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_feed_events_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels_public";
            referencedColumns: ["id"];
          },
        ];
      };
      channel_followers: {
        Row: {
          channel_id: string;
          followed_at: string;
          last_read_at: string;
          muted_until: string | null;
          user_id: string;
        };
        Insert: {
          channel_id: string;
          followed_at?: string;
          last_read_at?: string;
          muted_until?: string | null;
          user_id: string;
        };
        Update: {
          channel_id?: string;
          followed_at?: string;
          last_read_at?: string;
          muted_until?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "channel_followers_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_followers_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_followers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_followers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_followers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      channel_invitations: {
        Row: {
          accepted_at: string | null;
          channel_id: string;
          created_at: string;
          id: string;
          recipient_id: string;
          sender_id: string;
          status: string;
        };
        Insert: {
          accepted_at?: string | null;
          channel_id: string;
          created_at?: string;
          id?: string;
          recipient_id: string;
          sender_id: string;
          status?: string;
        };
        Update: {
          accepted_at?: string | null;
          channel_id?: string;
          created_at?: string;
          id?: string;
          recipient_id?: string;
          sender_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "channel_invitations_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_invitations_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_invitations_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_invitations_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_invitations_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_invitations_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_invitations_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_invitations_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      channel_staff: {
        Row: {
          channel_id: string;
          joined_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          channel_id: string;
          joined_at?: string;
          role: string;
          user_id: string;
        };
        Update: {
          channel_id?: string;
          joined_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "channel_staff_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_staff_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_staff_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_staff_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_staff_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      channels: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          description: string | null;
          follower_count: number;
          id: string;
          is_verified: boolean;
          last_message_at: string | null;
          last_message_id: string | null;
          last_message_preview: string | null;
          name: string;
          owner_id: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          description?: string | null;
          follower_count?: number;
          id?: string;
          is_verified?: boolean;
          last_message_at?: string | null;
          last_message_id?: string | null;
          last_message_preview?: string | null;
          name: string;
          owner_id?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          description?: string | null;
          follower_count?: number;
          id?: string;
          is_verified?: boolean;
          last_message_at?: string | null;
          last_message_id?: string | null;
          last_message_preview?: string | null;
          name?: string;
          owner_id?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "channels_last_message_id_fkey";
            columns: ["last_message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channels_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channels_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channels_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_invite_links: {
        Row: {
          chat_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          token: string;
          updated_at: string;
        };
        Insert: {
          chat_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          token?: string;
          updated_at?: string;
        };
        Update: {
          chat_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          token?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_invite_links_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: true;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_invite_links_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_invite_links_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_invite_links_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_members: {
        Row: {
          archived_at: string | null;
          chat_id: string;
          favorited_at: string | null;
          joined_at: string;
          last_read_at: string | null;
          manually_unread: boolean;
          muted_until: string | null;
          pinned_at: string | null;
          role: Database["public"]["Enums"]["chat_member_role"];
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          chat_id: string;
          favorited_at?: string | null;
          joined_at?: string;
          last_read_at?: string | null;
          manually_unread?: boolean;
          muted_until?: string | null;
          pinned_at?: string | null;
          role?: Database["public"]["Enums"]["chat_member_role"];
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          chat_id?: string;
          favorited_at?: string | null;
          joined_at?: string;
          last_read_at?: string | null;
          manually_unread?: boolean;
          muted_until?: string | null;
          pinned_at?: string | null;
          role?: Database["public"]["Enums"]["chat_member_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_members_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_requests: {
        Row: {
          chat_id: string;
          created_at: string;
          id: string;
          recipient_id: string;
          responded_at: string | null;
          sender_id: string;
          status: Database["public"]["Enums"]["chat_request_status"];
        };
        Insert: {
          chat_id: string;
          created_at?: string;
          id?: string;
          recipient_id: string;
          responded_at?: string | null;
          sender_id: string;
          status?: Database["public"]["Enums"]["chat_request_status"];
        };
        Update: {
          chat_id?: string;
          created_at?: string;
          id?: string;
          recipient_id?: string;
          responded_at?: string | null;
          sender_id?: string;
          status?: Database["public"]["Enums"]["chat_request_status"];
        };
        Relationships: [
          {
            foreignKeyName: "chat_requests_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_requests_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_requests_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_requests_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_requests_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_requests_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_requests_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      chats: {
        Row: {
          avatar_url: string | null;
          community_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          direct_pair_key: string | null;
          id: string;
          last_message_at: string | null;
          last_message_id: string | null;
          last_message_preview: string | null;
          name: string | null;
          only_admins_can_add_members: boolean;
          only_admins_can_edit_info: boolean;
          only_admins_can_send: boolean;
          only_admins_can_share_link: boolean;
          owner_id: string | null;
          rejected_at: string | null;
          require_admin_approval: boolean;
          status: Database["public"]["Enums"]["chat_status"];
          system_role: string | null;
          type: Database["public"]["Enums"]["chat_type"];
          updated_at: string;
          write_policy: string;
        };
        Insert: {
          avatar_url?: string | null;
          community_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          direct_pair_key?: string | null;
          id?: string;
          last_message_at?: string | null;
          last_message_id?: string | null;
          last_message_preview?: string | null;
          name?: string | null;
          only_admins_can_add_members?: boolean;
          only_admins_can_edit_info?: boolean;
          only_admins_can_send?: boolean;
          only_admins_can_share_link?: boolean;
          owner_id?: string | null;
          rejected_at?: string | null;
          require_admin_approval?: boolean;
          status?: Database["public"]["Enums"]["chat_status"];
          system_role?: string | null;
          type: Database["public"]["Enums"]["chat_type"];
          updated_at?: string;
          write_policy?: string;
        };
        Update: {
          avatar_url?: string | null;
          community_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          direct_pair_key?: string | null;
          id?: string;
          last_message_at?: string | null;
          last_message_id?: string | null;
          last_message_preview?: string | null;
          name?: string | null;
          only_admins_can_add_members?: boolean;
          only_admins_can_edit_info?: boolean;
          only_admins_can_send?: boolean;
          only_admins_can_share_link?: boolean;
          owner_id?: string | null;
          rejected_at?: string | null;
          require_admin_approval?: boolean;
          status?: Database["public"]["Enums"]["chat_status"];
          system_role?: string | null;
          type?: Database["public"]["Enums"]["chat_type"];
          updated_at?: string;
          write_policy?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chats_community_id_fkey";
            columns: ["community_id"];
            isOneToOne: false;
            referencedRelation: "communities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chats_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chats_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chats_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chats_last_message_id_fkey";
            columns: ["last_message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chats_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chats_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chats_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      communities: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          description: string | null;
          id: string;
          member_count: number;
          name: string;
          owner_id: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          member_count?: number;
          name: string;
          owner_id?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          member_count?: number;
          name?: string;
          owner_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "communities_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "communities_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "communities_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      community_announcement_writers: {
        Row: {
          community_id: string;
          granted_at: string;
          granted_by: string | null;
          user_id: string;
        };
        Insert: {
          community_id: string;
          granted_at?: string;
          granted_by?: string | null;
          user_id: string;
        };
        Update: {
          community_id?: string;
          granted_at?: string;
          granted_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_announcement_writers_community_id_fkey";
            columns: ["community_id"];
            isOneToOne: false;
            referencedRelation: "communities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_announcement_writers_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_announcement_writers_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_announcement_writers_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_announcement_writers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_announcement_writers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_announcement_writers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      community_audit_logs: {
        Row: {
          action_type: string;
          actor_id: string | null;
          community_id: string;
          created_at: string;
          details: Json;
          id: string;
          reason: string | null;
          target_chat_id: string | null;
          target_user_id: string | null;
        };
        Insert: {
          action_type: string;
          actor_id?: string | null;
          community_id: string;
          created_at?: string;
          details?: Json;
          id?: string;
          reason?: string | null;
          target_chat_id?: string | null;
          target_user_id?: string | null;
        };
        Update: {
          action_type?: string;
          actor_id?: string | null;
          community_id?: string;
          created_at?: string;
          details?: Json;
          id?: string;
          reason?: string | null;
          target_chat_id?: string | null;
          target_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "community_audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_audit_logs_community_id_fkey";
            columns: ["community_id"];
            isOneToOne: false;
            referencedRelation: "communities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_audit_logs_target_chat_id_fkey";
            columns: ["target_chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_audit_logs_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_audit_logs_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_audit_logs_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      community_bans: {
        Row: {
          banned_by: string | null;
          community_id: string;
          created_at: string;
          reason: string | null;
          user_id: string;
        };
        Insert: {
          banned_by?: string | null;
          community_id: string;
          created_at?: string;
          reason?: string | null;
          user_id: string;
        };
        Update: {
          banned_by?: string | null;
          community_id?: string;
          created_at?: string;
          reason?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_bans_banned_by_fkey";
            columns: ["banned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_bans_banned_by_fkey";
            columns: ["banned_by"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_bans_banned_by_fkey";
            columns: ["banned_by"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_bans_community_id_fkey";
            columns: ["community_id"];
            isOneToOne: false;
            referencedRelation: "communities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_bans_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_bans_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_bans_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      community_members: {
        Row: {
          community_id: string;
          joined_at: string;
          role: Database["public"]["Enums"]["chat_member_role"];
          silence_reason: string | null;
          silenced_by: string | null;
          silenced_until: string | null;
          user_id: string;
        };
        Insert: {
          community_id: string;
          joined_at?: string;
          role?: Database["public"]["Enums"]["chat_member_role"];
          silence_reason?: string | null;
          silenced_by?: string | null;
          silenced_until?: string | null;
          user_id: string;
        };
        Update: {
          community_id?: string;
          joined_at?: string;
          role?: Database["public"]["Enums"]["chat_member_role"];
          silence_reason?: string | null;
          silenced_by?: string | null;
          silenced_until?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey";
            columns: ["community_id"];
            isOneToOne: false;
            referencedRelation: "communities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_members_silenced_by_fkey";
            columns: ["silenced_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_members_silenced_by_fkey";
            columns: ["silenced_by"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_members_silenced_by_fkey";
            columns: ["silenced_by"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      devices: {
        Row: {
          created_at: string;
          device_fingerprint: string | null;
          device_name: string;
          device_type: string;
          id: string;
          last_active_at: string;
          push_subscription: Json | null;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          device_fingerprint?: string | null;
          device_name: string;
          device_type?: string;
          id?: string;
          last_active_at?: string;
          push_subscription?: Json | null;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          device_fingerprint?: string | null;
          device_name?: string;
          device_type?: string;
          id?: string;
          last_active_at?: string;
          push_subscription?: Json | null;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "devices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "devices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "devices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      file_uploads: {
        Row: {
          bucket: string;
          completed_at: string | null;
          created_at: string;
          duration_seconds: number | null;
          hash_sha256: string | null;
          height: number | null;
          id: string;
          mime_type: string;
          original_filename: string;
          path: string;
          size_bytes: number;
          status: Database["public"]["Enums"]["upload_status"];
          uploader_id: string;
          width: number | null;
        };
        Insert: {
          bucket: string;
          completed_at?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          hash_sha256?: string | null;
          height?: number | null;
          id?: string;
          mime_type: string;
          original_filename: string;
          path: string;
          size_bytes: number;
          status?: Database["public"]["Enums"]["upload_status"];
          uploader_id: string;
          width?: number | null;
        };
        Update: {
          bucket?: string;
          completed_at?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          hash_sha256?: string | null;
          height?: number | null;
          id?: string;
          mime_type?: string;
          original_filename?: string;
          path?: string;
          size_bytes?: number;
          status?: Database["public"]["Enums"]["upload_status"];
          uploader_id?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "file_uploads_uploader_id_fkey";
            columns: ["uploader_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "file_uploads_uploader_id_fkey";
            columns: ["uploader_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "file_uploads_uploader_id_fkey";
            columns: ["uploader_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      group_join_requests: {
        Row: {
          chat_id: string;
          created_at: string;
          id: string;
          requested_by: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          target_user_id: string;
        };
        Insert: {
          chat_id: string;
          created_at?: string;
          id?: string;
          requested_by: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          target_user_id: string;
        };
        Update: {
          chat_id?: string;
          created_at?: string;
          id?: string;
          requested_by?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          target_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_join_requests_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_join_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_join_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_join_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_join_requests_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_join_requests_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_join_requests_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_join_requests_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_join_requests_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_join_requests_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      message_deletions: {
        Row: {
          deleted_at: string;
          message_id: string;
          user_id: string;
        };
        Insert: {
          deleted_at?: string;
          message_id: string;
          user_id: string;
        };
        Update: {
          deleted_at?: string;
          message_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_deletions_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_deletions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_deletions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_deletions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      message_reactions: {
        Row: {
          created_at: string;
          emoji: string;
          message_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          emoji: string;
          message_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          emoji?: string;
          message_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      message_receipts: {
        Row: {
          delivered_at: string | null;
          message_id: string;
          read_at: string | null;
          user_id: string;
        };
        Insert: {
          delivered_at?: string | null;
          message_id: string;
          read_at?: string | null;
          user_id: string;
        };
        Update: {
          delivered_at?: string | null;
          message_id?: string;
          read_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_receipts_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_receipts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_receipts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_receipts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          channel_id: string | null;
          chat_id: string | null;
          contact_data: Json | null;
          content: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_for_everyone: boolean;
          edited_at: string | null;
          file_upload_id: string | null;
          forwarded_from_message_id: string | null;
          id: string;
          is_pinned_in_chat: boolean;
          location_data: Json | null;
          media_peaks: number[] | null;
          media_thumbnail_upload_id: string | null;
          mentions: string[] | null;
          reply_to_message_id: string | null;
          reply_to_story_id: string | null;
          sender_id: string | null;
          type: Database["public"]["Enums"]["message_type"];
        };
        Insert: {
          channel_id?: string | null;
          chat_id?: string | null;
          contact_data?: Json | null;
          content?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_for_everyone?: boolean;
          edited_at?: string | null;
          file_upload_id?: string | null;
          forwarded_from_message_id?: string | null;
          id?: string;
          is_pinned_in_chat?: boolean;
          location_data?: Json | null;
          media_peaks?: number[] | null;
          media_thumbnail_upload_id?: string | null;
          mentions?: string[] | null;
          reply_to_message_id?: string | null;
          reply_to_story_id?: string | null;
          sender_id?: string | null;
          type?: Database["public"]["Enums"]["message_type"];
        };
        Update: {
          channel_id?: string | null;
          chat_id?: string | null;
          contact_data?: Json | null;
          content?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_for_everyone?: boolean;
          edited_at?: string | null;
          file_upload_id?: string | null;
          forwarded_from_message_id?: string | null;
          id?: string;
          is_pinned_in_chat?: boolean;
          location_data?: Json | null;
          media_peaks?: number[] | null;
          media_thumbnail_upload_id?: string | null;
          mentions?: string[] | null;
          reply_to_message_id?: string | null;
          reply_to_story_id?: string | null;
          sender_id?: string | null;
          type?: Database["public"]["Enums"]["message_type"];
        };
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_file_upload_id_fkey";
            columns: ["file_upload_id"];
            isOneToOne: false;
            referencedRelation: "file_uploads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_file_upload_id_fkey";
            columns: ["file_upload_id"];
            isOneToOne: false;
            referencedRelation: "message_media_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_forwarded_from_message_id_fkey";
            columns: ["forwarded_from_message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_media_thumbnail_upload_id_fkey";
            columns: ["media_thumbnail_upload_id"];
            isOneToOne: false;
            referencedRelation: "file_uploads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_media_thumbnail_upload_id_fkey";
            columns: ["media_thumbnail_upload_id"];
            isOneToOne: false;
            referencedRelation: "message_media_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey";
            columns: ["reply_to_message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_reply_to_story_id_fkey";
            columns: ["reply_to_story_id"];
            isOneToOne: false;
            referencedRelation: "stories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          first_name: string | null;
          id: string;
          last_name: string | null;
          last_seen_at: string | null;
          scheduled_deletion_at: string | null;
          social_links: Json;
          updated_at: string;
          username: string;
          username_changed_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          first_name?: string | null;
          id: string;
          last_name?: string | null;
          last_seen_at?: string | null;
          scheduled_deletion_at?: string | null;
          social_links?: Json;
          updated_at?: string;
          username: string;
          username_changed_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          last_seen_at?: string | null;
          scheduled_deletion_at?: string | null;
          social_links?: Json;
          updated_at?: string;
          username?: string;
          username_changed_at?: string | null;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          reason: string;
          reported_channel_id: string | null;
          reported_chat_id: string | null;
          reported_message_id: string | null;
          reported_user_id: string | null;
          reporter_id: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["report_status"];
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          reason: string;
          reported_channel_id?: string | null;
          reported_chat_id?: string | null;
          reported_message_id?: string | null;
          reported_user_id?: string | null;
          reporter_id?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          reason?: string;
          reported_channel_id?: string | null;
          reported_chat_id?: string | null;
          reported_message_id?: string | null;
          reported_user_id?: string | null;
          reporter_id?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
        };
        Relationships: [
          {
            foreignKeyName: "reports_reported_channel_id_fkey";
            columns: ["reported_channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reported_channel_id_fkey";
            columns: ["reported_channel_id"];
            isOneToOne: false;
            referencedRelation: "channels_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reported_chat_id_fkey";
            columns: ["reported_chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reported_message_id_fkey";
            columns: ["reported_message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey";
            columns: ["reported_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey";
            columns: ["reported_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey";
            columns: ["reported_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      stories: {
        Row: {
          background_color: string | null;
          caption: string | null;
          created_at: string;
          expires_at: string;
          file_upload_id: string | null;
          id: string;
          media_thumbnail_upload_id: string | null;
          media_type: Database["public"]["Enums"]["story_media_type"];
          text_content: string | null;
          user_id: string;
        };
        Insert: {
          background_color?: string | null;
          caption?: string | null;
          created_at?: string;
          expires_at?: string;
          file_upload_id?: string | null;
          id?: string;
          media_thumbnail_upload_id?: string | null;
          media_type: Database["public"]["Enums"]["story_media_type"];
          text_content?: string | null;
          user_id: string;
        };
        Update: {
          background_color?: string | null;
          caption?: string | null;
          created_at?: string;
          expires_at?: string;
          file_upload_id?: string | null;
          id?: string;
          media_thumbnail_upload_id?: string | null;
          media_type?: Database["public"]["Enums"]["story_media_type"];
          text_content?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stories_file_upload_id_fkey";
            columns: ["file_upload_id"];
            isOneToOne: false;
            referencedRelation: "file_uploads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stories_file_upload_id_fkey";
            columns: ["file_upload_id"];
            isOneToOne: false;
            referencedRelation: "message_media_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stories_media_thumbnail_upload_id_fkey";
            columns: ["media_thumbnail_upload_id"];
            isOneToOne: false;
            referencedRelation: "file_uploads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stories_media_thumbnail_upload_id_fkey";
            columns: ["media_thumbnail_upload_id"];
            isOneToOne: false;
            referencedRelation: "message_media_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stories_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stories_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stories_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      story_views: {
        Row: {
          story_id: string;
          viewed_at: string;
          viewer_id: string;
        };
        Insert: {
          story_id: string;
          viewed_at?: string;
          viewer_id: string;
        };
        Update: {
          story_id?: string;
          viewed_at?: string;
          viewer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey";
            columns: ["story_id"];
            isOneToOne: false;
            referencedRelation: "stories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey";
            columns: ["viewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey";
            columns: ["viewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey";
            columns: ["viewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      two_factor_backup_codes: {
        Row: {
          code_hash: string;
          created_at: string;
          id: string;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          code_hash: string;
          created_at?: string;
          id?: string;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          code_hash?: string;
          created_at?: string;
          id?: string;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "two_factor_backup_codes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "two_factor_backup_codes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "two_factor_backup_codes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      user_blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey";
            columns: ["blocked_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey";
            columns: ["blocked_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey";
            columns: ["blocked_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey";
            columns: ["blocker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey";
            columns: ["blocker_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey";
            columns: ["blocker_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      user_settings: {
        Row: {
          accent: Database["public"]["Enums"]["accent_theme"];
          language: Database["public"]["Enums"]["language_preference"];
          notification_previews_enabled: boolean;
          notification_sound_enabled: boolean;
          notifications_enabled: boolean;
          presence_visible: boolean;
          profile_photo_exclusions: string[];
          profile_photo_visibility: string;
          read_receipts_enabled: boolean;
          story_exclusions: string[];
          story_visibility: string;
          theme: Database["public"]["Enums"]["theme_preference"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          accent?: Database["public"]["Enums"]["accent_theme"];
          language?: Database["public"]["Enums"]["language_preference"];
          notification_previews_enabled?: boolean;
          notification_sound_enabled?: boolean;
          notifications_enabled?: boolean;
          presence_visible?: boolean;
          profile_photo_exclusions?: string[];
          profile_photo_visibility?: string;
          read_receipts_enabled?: boolean;
          story_exclusions?: string[];
          story_visibility?: string;
          theme?: Database["public"]["Enums"]["theme_preference"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          accent?: Database["public"]["Enums"]["accent_theme"];
          language?: Database["public"]["Enums"]["language_preference"];
          notification_previews_enabled?: boolean;
          notification_sound_enabled?: boolean;
          notifications_enabled?: boolean;
          presence_visible?: boolean;
          profile_photo_exclusions?: string[];
          profile_photo_visibility?: string;
          read_receipts_enabled?: boolean;
          story_exclusions?: string[];
          story_visibility?: string;
          theme?: Database["public"]["Enums"]["theme_preference"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      channel_invitations_received: {
        Row: {
          channel_id: string | null;
          created_at: string | null;
          id: string | null;
          status: string | null;
        };
        Insert: {
          channel_id?: string | null;
          created_at?: string | null;
          id?: string | null;
          status?: string | null;
        };
        Update: {
          channel_id?: string | null;
          created_at?: string | null;
          id?: string | null;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "channel_invitations_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_invitations_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels_public";
            referencedColumns: ["id"];
          },
        ];
      };
      channel_invitations_sent: {
        Row: {
          accepted_at: string | null;
          channel_id: string | null;
          created_at: string | null;
          id: string | null;
          recipient_id: string | null;
          status: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          channel_id?: string | null;
          created_at?: string | null;
          id?: string | null;
          recipient_id?: string | null;
          status?: never;
        };
        Update: {
          accepted_at?: string | null;
          channel_id?: string | null;
          created_at?: string | null;
          id?: string | null;
          recipient_id?: string | null;
          status?: never;
        };
        Relationships: [
          {
            foreignKeyName: "channel_invitations_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_invitations_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_invitations_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_invitations_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles_blocked";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_invitations_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      channels_public: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          description: string | null;
          follower_count: number | null;
          id: string | null;
          is_verified: boolean | null;
          last_message_at: string | null;
          last_message_id: string | null;
          last_message_preview: string | null;
          name: string | null;
          slug: string | null;
          updated_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          description?: string | null;
          follower_count?: number | null;
          id?: string | null;
          is_verified?: boolean | null;
          last_message_at?: string | null;
          last_message_id?: string | null;
          last_message_preview?: string | null;
          name?: string | null;
          slug?: string | null;
          updated_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          description?: string | null;
          follower_count?: number | null;
          id?: string | null;
          is_verified?: boolean | null;
          last_message_at?: string | null;
          last_message_id?: string | null;
          last_message_preview?: string | null;
          name?: string | null;
          slug?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "channels_last_message_id_fkey";
            columns: ["last_message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      message_media_public: {
        Row: {
          bucket: string | null;
          completed_at: string | null;
          created_at: string | null;
          duration_seconds: number | null;
          height: number | null;
          id: string | null;
          mime_type: string | null;
          original_filename: string | null;
          path: string | null;
          size_bytes: number | null;
          status: Database["public"]["Enums"]["upload_status"] | null;
          width: number | null;
        };
        Insert: {
          bucket?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          duration_seconds?: number | null;
          height?: number | null;
          id?: string | null;
          mime_type?: string | null;
          original_filename?: string | null;
          path?: string | null;
          size_bytes?: number | null;
          status?: Database["public"]["Enums"]["upload_status"] | null;
          width?: number | null;
        };
        Update: {
          bucket?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          duration_seconds?: number | null;
          height?: number | null;
          id?: string | null;
          mime_type?: string | null;
          original_filename?: string | null;
          path?: string | null;
          size_bytes?: number | null;
          status?: Database["public"]["Enums"]["upload_status"] | null;
          width?: number | null;
        };
        Relationships: [];
      };
      profiles_blocked: {
        Row: {
          avatar_initials: string | null;
          display_name: string | null;
          id: string | null;
          username: string | null;
        };
        Relationships: [];
      };
      profiles_visible: {
        Row: {
          avatar_initials: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string | null;
          display_name: string | null;
          id: string | null;
          last_seen_at: string | null;
          social_links: Json | null;
          updated_at: string | null;
          username: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_chat_request: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
      add_chat_member: {
        Args: { p_chat_id: string; p_user_id: string };
        Returns: undefined;
      };
      add_chat_members: {
        Args: { p_chat_id: string; p_user_ids: string[] };
        Returns: number;
      };
      answerable_incoming_calls: {
        Args: { p_call_id?: string };
        Returns: {
          chat_id: string;
          expires_in_ms: number;
          id: string;
          initiator_id: string;
          livekit_room_name: string;
          started_at: string;
          type: Database["public"]["Enums"]["call_type"];
        }[];
      };
      appoint_channel_admin: {
        Args: { p_channel_id: string; p_user_id: string };
        Returns: undefined;
      };
      appoint_community_moderator: {
        Args: { p_community_id: string; p_user_id: string };
        Returns: undefined;
      };
      auth_mfa_satisfied: { Args: never; Returns: boolean };
      authorize_channel_avatar_read: {
        Args: { p_channel_id: string; p_path: string };
        Returns: {
          bucket: string;
          path: string;
        }[];
      };
      authorize_channel_post_media_read: {
        Args: { p_channel_id: string; p_upload_id: string };
        Returns: {
          bucket: string;
          path: string;
        }[];
      };
      authorize_forwarded_channel_media_read: {
        Args: { p_message_id: string; p_upload_id: string };
        Returns: {
          bucket: string;
          path: string;
        }[];
      };
      can_access_chat_message: {
        Args: { p_include_deleted?: boolean; p_message_id: string };
        Returns: boolean;
      };
      can_add_group_members: {
        Args: { p_chat_id: string; p_user_id: string };
        Returns: boolean;
      };
      can_edit_group_info: {
        Args: { p_chat_id: string; p_user_id: string };
        Returns: boolean;
      };
      can_share_group_invite: {
        Args: { p_chat_id: string; p_user_id: string };
        Returns: boolean;
      };
      can_view_avatar: {
        Args: { p_owner: string; p_viewer: string };
        Returns: boolean;
      };
      can_view_story: {
        Args: { p_owner: string; p_viewer: string };
        Returns: boolean;
      };
      can_write_community_chat: {
        Args: { p_chat_id: string; p_user_id: string };
        Returns: boolean;
      };
      cancel_account_deletion: { Args: never; Returns: undefined };
      clear_chat_for_me: { Args: { p_chat_id: string }; Returns: number };
      community_role_rank: {
        Args: { p_community_id: string; p_user_id: string };
        Returns: number;
      };
      compute_message_preview: {
        Args: { m: Database["public"]["Tables"]["messages"]["Row"] };
        Returns: string;
      };
      consume_backup_code: {
        Args: { p_challenge_id: string; p_code_hash: string; p_user_id: string };
        Returns: boolean;
      };
      create_channel: {
        Args: {
          p_channel_id?: string;
          p_description: string;
          p_name: string;
          p_slug: string;
        };
        Returns: string;
      };
      create_community: {
        Args: { p_description?: string; p_name: string };
        Returns: string;
      };
      create_community_chat: {
        Args: {
          p_community_id: string;
          p_description?: string;
          p_name: string;
          p_only_admins_can_send?: boolean;
          p_write_policy?: string;
        };
        Returns: string;
      };
      create_direct_chat_request: {
        Args: { p_initial_content: string; p_target_user_id: string };
        Returns: string;
      };
      create_group_chat: {
        Args: {
          p_member_ids: string[];
          p_name: string;
          p_only_admins_can_add_members?: boolean;
          p_only_admins_can_edit_info?: boolean;
          p_only_admins_can_send?: boolean;
          p_only_admins_can_share_link?: boolean;
          p_require_admin_approval?: boolean;
        };
        Returns: string;
      };
      create_self_chat: { Args: never; Returns: string };
      create_story: {
        Args: {
          p_background_color?: string;
          p_caption?: string;
          p_file_upload_id?: string;
          p_media_type: Database["public"]["Enums"]["story_media_type"];
          p_story_id?: string;
          p_text_content?: string;
          p_thumbnail_upload_id?: string;
        };
        Returns: string;
      };
      delete_channel: { Args: { p_channel_id: string }; Returns: undefined };
      delete_channel_post: {
        Args: { p_message_id: string };
        Returns: undefined;
      };
      delete_chat_message_for_me: {
        Args: { p_message_id: string };
        Returns: undefined;
      };
      delete_community: { Args: { p_community_id: string }; Returns: undefined };
      delete_community_chat: { Args: { p_chat_id: string }; Returns: undefined };
      delete_direct_chat_for_me: {
        Args: { p_chat_id: string };
        Returns: undefined;
      };
      delete_message_for_everyone: {
        Args: { p_message_id: string };
        Returns: undefined;
      };
      delete_self_chat: { Args: { p_chat_id: string }; Returns: undefined };
      delete_story: { Args: { p_story_id: string }; Returns: undefined };
      demote_chat_admin: {
        Args: { p_chat_id: string; p_user_id: string };
        Returns: undefined;
      };
      demote_community_admin: {
        Args: { p_community_id: string; p_user_id: string };
        Returns: undefined;
      };
      dismiss_channel_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      expel_community_member: {
        Args: {
          p_community_id: string;
          p_delete_messages?: boolean;
          p_reason?: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      follow_channel: {
        Args: { p_channel_id: string; p_invitation_id?: string };
        Returns: undefined;
      };
      forward_chat_message: {
        Args: {
          p_chat_ids: string[];
          p_message_id: string;
          p_message_ids: string[];
        };
        Returns: undefined;
      };
      get_channel_messages: {
        Args: {
          p_before_at?: string;
          p_before_id?: string;
          p_channel_id: string;
        };
        Returns: {
          channel_id: string | null;
          chat_id: string | null;
          contact_data: Json | null;
          content: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_for_everyone: boolean;
          edited_at: string | null;
          file_upload_id: string | null;
          forwarded_from_message_id: string | null;
          id: string;
          is_pinned_in_chat: boolean;
          location_data: Json | null;
          media_peaks: number[] | null;
          media_thumbnail_upload_id: string | null;
          mentions: string[] | null;
          reply_to_message_id: string | null;
          reply_to_story_id: string | null;
          sender_id: string | null;
          type: Database["public"]["Enums"]["message_type"];
        }[];
        SetofOptions: {
          from: "*";
          to: "messages";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_channel_staff: {
        Args: { p_channel_id: string };
        Returns: {
          avatar_url: string;
          display_name: string;
          joined_at: string;
          role: string;
          user_id: string;
          username: string;
        }[];
      };
      get_channel_viewer_context: {
        Args: { p_channel_id: string };
        Returns: Json;
      };
      get_chat_messages: {
        Args: { p_before_at?: string; p_before_id?: string; p_chat_id: string };
        Returns: {
          channel_id: string | null;
          chat_id: string | null;
          contact_data: Json | null;
          content: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_for_everyone: boolean;
          edited_at: string | null;
          file_upload_id: string | null;
          forwarded_from_message_id: string | null;
          id: string;
          is_pinned_in_chat: boolean;
          location_data: Json | null;
          media_peaks: number[] | null;
          media_thumbnail_upload_id: string | null;
          mentions: string[] | null;
          reply_to_message_id: string | null;
          reply_to_story_id: string | null;
          sender_id: string | null;
          type: Database["public"]["Enums"]["message_type"];
        }[];
        SetofOptions: {
          from: "*";
          to: "messages";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_group_invite: { Args: { p_chat_id: string }; Returns: string };
      get_my_storage_usage: { Args: never; Returns: number };
      get_story_viewers: {
        Args: { p_story_id: string };
        Returns: {
          avatar_url: string;
          display_name: string;
          username: string;
          viewed_at: string;
          viewer_id: string;
        }[];
      };
      has_read_receipts_enabled: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      is_blocked: {
        Args: { p_blocked: string; p_blocker: string };
        Returns: boolean;
      };
      is_blocked_either_way: {
        Args: { p_user_a: string; p_user_b: string };
        Returns: boolean;
      };
      is_channel_follower: {
        Args: { p_channel_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_channel_owner: {
        Args: { p_channel_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_channel_staff: {
        Args: { p_channel_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_chat_active: { Args: { p_chat_id: string }; Returns: boolean };
      is_chat_admin: {
        Args: { p_chat_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_chat_member: {
        Args: { p_chat_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_community_admin_or_owner: {
        Args: { p_community_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_community_member: {
        Args: { p_community_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_community_staff: {
        Args: { p_community_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_contact: {
        Args: { p_user_a: string; p_user_b: string };
        Returns: boolean;
      };
      is_group_owner: {
        Args: { p_chat_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_group_owner_or_admin: {
        Args: { p_chat_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_message_deleted_for_user: {
        Args: { p_message_id: string; p_user_id: string };
        Returns: boolean;
      };
      join_community:
        | { Args: { p_community_id: string }; Returns: undefined }
        | {
            Args: { p_community_id: string; p_user_id: string };
            Returns: undefined;
          };
      join_group_via_invite: { Args: { p_token: string }; Returns: string };
      leave_community: { Args: { p_community_id: string }; Returns: undefined };
      mark_chat_as_read: { Args: { p_chat_id: string }; Returns: undefined };
      mark_chat_as_unread: { Args: { p_chat_id: string }; Returns: undefined };
      mark_story_viewed: { Args: { p_story_id: string }; Returns: undefined };
      moderate_delete_community_message: {
        Args: { p_message_id: string };
        Returns: undefined;
      };
      mute_community: {
        Args: { p_community_id: string; p_muted_until: string };
        Returns: undefined;
      };
      own_upload_is_referenced: {
        Args: { p_upload_id: string };
        Returns: boolean;
      };
      promote_chat_admin: {
        Args: { p_chat_id: string; p_user_id: string };
        Returns: undefined;
      };
      promote_community_admin: {
        Args: { p_community_id: string; p_user_id: string };
        Returns: undefined;
      };
      reject_chat_request: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
      remove_channel_admin: {
        Args: { p_channel_id: string; p_user_id: string };
        Returns: undefined;
      };
      remove_chat_member: {
        Args: { p_chat_id: string; p_user_id: string };
        Returns: undefined;
      };
      remove_community_member: {
        Args: { p_community_id: string; p_user_id: string };
        Returns: undefined;
      };
      remove_community_moderator: {
        Args: { p_community_id: string; p_user_id: string };
        Returns: undefined;
      };
      replace_backup_codes: {
        Args: { p_hashes: string[]; p_user_id: string };
        Returns: undefined;
      };
      request_group_member_add: {
        Args: { p_chat_id: string; p_user_ids: string[] };
        Returns: Json;
      };
      review_group_join_request: {
        Args: { p_approve: boolean; p_request_id: string };
        Returns: undefined;
      };
      revoke_group_invite: { Args: { p_chat_id: string }; Returns: undefined };
      rotate_group_invite: { Args: { p_chat_id: string }; Returns: string };
      schedule_account_deletion: { Args: never; Returns: string };
      send_channel_invitations: {
        Args: { p_channel_id: string; p_invitations: Json };
        Returns: Json;
      };
      set_announcement_writer: {
        Args: { p_community_id: string; p_grant: boolean; p_user_id: string };
        Returns: undefined;
      };
      set_message_pin: {
        Args: { p_message_id: string; p_pin: boolean };
        Returns: undefined;
      };
      set_message_reaction: {
        Args: { p_emoji?: string; p_message_id: string };
        Returns: undefined;
      };
      silence_community_member: {
        Args: {
          p_community_id: string;
          p_reason?: string;
          p_silenced_until: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      start_call: {
        Args: {
          p_chat_id: string;
          p_type: Database["public"]["Enums"]["call_type"];
        };
        Returns: string;
      };
      transfer_channel_ownership: {
        Args: { p_channel_id: string; p_new_owner_id: string };
        Returns: undefined;
      };
      transfer_community_ownership: {
        Args: { p_community_id: string; p_new_owner_id: string };
        Returns: undefined;
      };
      transfer_group_ownership: {
        Args: { p_chat_id: string; p_new_owner_id: string };
        Returns: undefined;
      };
      unban_community_member: {
        Args: { p_community_id: string; p_user_id: string };
        Returns: undefined;
      };
      unfollow_channel: { Args: { p_channel_id: string }; Returns: undefined };
      unsilence_community_member: {
        Args: { p_community_id: string; p_user_id: string };
        Returns: undefined;
      };
      update_channel_info: {
        Args: {
          p_avatar_url?: string;
          p_channel_id: string;
          p_description?: string;
          p_name?: string;
          p_slug?: string;
        };
        Returns: undefined;
      };
      update_community_chat_avatar: {
        Args: { p_avatar_url: string; p_chat_id: string };
        Returns: undefined;
      };
      update_community_chat_info: {
        Args: { p_chat_id: string; p_description?: string; p_name?: string };
        Returns: undefined;
      };
      update_community_chat_write_policy: {
        Args: { p_chat_id: string; p_write_policy: string };
        Returns: undefined;
      };
      update_community_info: {
        Args: {
          p_avatar_url?: string;
          p_community_id: string;
          p_description?: string;
          p_name?: string;
        };
        Returns: undefined;
      };
      update_group_info: {
        Args: {
          p_avatar_url?: string;
          p_chat_id: string;
          p_description?: string;
          p_name?: string;
          p_only_admins_can_add_members?: boolean;
          p_only_admins_can_edit_info?: boolean;
          p_only_admins_can_send?: boolean;
          p_only_admins_can_share_link?: boolean;
          p_require_admin_approval?: boolean;
        };
        Returns: undefined;
      };
    };
    Enums: {
      accent_theme: "blue" | "purple" | "red" | "orange" | "yellow" | "green";
      call_status: "ringing" | "answered" | "missed" | "declined" | "canceled" | "failed" | "ended";
      call_type: "voice" | "video";
      chat_member_role: "admin" | "member" | "moderator";
      chat_request_status: "pending" | "accepted" | "rejected";
      chat_status: "active" | "pending_request" | "rejected";
      chat_type: "direct" | "group" | "self" | "community_chat";
      language_preference: "en" | "es";
      message_type:
        | "text"
        | "image"
        | "video"
        | "audio"
        | "file"
        | "sticker"
        | "location"
        | "contact"
        | "system";
      report_status: "pending" | "reviewed" | "resolved" | "dismissed";
      story_media_type: "image" | "video" | "text";
      theme_preference: "light" | "dark" | "system";
      upload_status: "pending" | "uploading" | "completed" | "failed" | "aborted";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      accent_theme: ["blue", "purple", "red", "orange", "yellow", "green"],
      call_status: ["ringing", "answered", "missed", "declined", "canceled", "failed", "ended"],
      call_type: ["voice", "video"],
      chat_member_role: ["admin", "member", "moderator"],
      chat_request_status: ["pending", "accepted", "rejected"],
      chat_status: ["active", "pending_request", "rejected"],
      chat_type: ["direct", "group", "self", "community_chat"],
      language_preference: ["en", "es"],
      message_type: [
        "text",
        "image",
        "video",
        "audio",
        "file",
        "sticker",
        "location",
        "contact",
        "system",
      ],
      report_status: ["pending", "reviewed", "resolved", "dismissed"],
      story_media_type: ["image", "video", "text"],
      theme_preference: ["light", "dark", "system"],
      upload_status: ["pending", "uploading", "completed", "failed", "aborted"],
    },
  },
} as const;
