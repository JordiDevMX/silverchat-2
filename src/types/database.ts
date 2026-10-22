export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      app_config: {
        Row: {
          description: string | null;
          key: string;
          updated_at: string;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          description?: string | null;
          key: string;
          updated_at?: string;
          value: NonNullable<Json>;
        };
        Update: {
          description?: string | null;
          key?: string;
          updated_at?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      calls: {
        Row: {
          answered_at: string | null;
          chat_id: string;
          duration_seconds: number | null;
          ended_at: string | null;
          id: string;
          initiator_id: string | null;
          livekit_room_name: string;
          started_at: string;
          status: Database["public"]["Enums"]["call_status"];
          type: Database["public"]["Enums"]["call_type"];
        };
        ComputedFields: never;
        Insert: {
          answered_at?: string | null;
          chat_id: string;
          duration_seconds?: number | null;
          ended_at?: string | null;
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
          duration_seconds?: number | null;
          ended_at?: string | null;
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
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      channel_followers: {
        Row: {
          channel_id: string;
          followed_at: string;
          last_read_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          channel_id: string;
          followed_at?: string;
          last_read_at?: string;
          user_id: string;
        };
        Update: {
          channel_id?: string;
          followed_at?: string;
          last_read_at?: string;
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
        ComputedFields: never;
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
          last_read_at: string;
          muted_until: string | null;
          pinned_at: string | null;
          role: Database["public"]["Enums"]["chat_member_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          chat_id: string;
          favorited_at?: string | null;
          joined_at?: string;
          last_read_at?: string;
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
          last_read_at?: string;
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
        ComputedFields: never;
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
          rejected_at: string | null;
          status: Database["public"]["Enums"]["chat_status"];
          type: Database["public"]["Enums"]["chat_type"];
          updated_at: string;
        };
        ComputedFields: never;
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
          rejected_at?: string | null;
          status?: Database["public"]["Enums"]["chat_status"];
          type: Database["public"]["Enums"]["chat_type"];
          updated_at?: string;
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
          rejected_at?: string | null;
          status?: Database["public"]["Enums"]["chat_status"];
          type?: Database["public"]["Enums"]["chat_type"];
          updated_at?: string;
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
        ComputedFields: never;
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
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          community_id: string;
          joined_at?: string;
          role?: Database["public"]["Enums"]["chat_member_role"];
          user_id: string;
        };
        Update: {
          community_id?: string;
          joined_at?: string;
          role?: Database["public"]["Enums"]["chat_member_role"];
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
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
      devices: {
        Row: {
          created_at: string;
          device_name: string;
          device_type: string;
          id: string;
          last_active_at: string;
          push_subscription: Json | null;
          user_agent: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
          id: string;
          is_pinned_in_chat: boolean;
          location_data: Json | null;
          reply_to_message_id: string | null;
          sender_id: string | null;
          type: Database["public"]["Enums"]["message_type"];
          compute_message_preview: string | null;
        };
        ComputedFields: "compute_message_preview";
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
          id?: string;
          is_pinned_in_chat?: boolean;
          location_data?: Json | null;
          reply_to_message_id?: string | null;
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
          id?: string;
          is_pinned_in_chat?: boolean;
          location_data?: Json | null;
          reply_to_message_id?: string | null;
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
            foreignKeyName: "messages_reply_to_message_id_fkey";
            columns: ["reply_to_message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
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
          social_links: NonNullable<Json>;
          updated_at: string;
          username: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          first_name?: string | null;
          id: string;
          last_name?: string | null;
          last_seen_at?: string | null;
          social_links?: NonNullable<Json>;
          updated_at?: string;
          username: string;
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
          social_links?: NonNullable<Json>;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          reason: string;
          reported_chat_id: string | null;
          reported_message_id: string | null;
          reported_user_id: string | null;
          reporter_id: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["report_status"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          reason: string;
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
          media_type: Database["public"]["Enums"]["story_media_type"];
          text_content: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          background_color?: string | null;
          caption?: string | null;
          created_at?: string;
          expires_at?: string;
          file_upload_id?: string | null;
          id?: string;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
            referencedRelation: "profiles_visible";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      profiles_visible: {
        Row: {
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
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      accept_chat_request: { Args: { p_request_id: string }; Returns: undefined };
      add_chat_member: { Args: { p_chat_id: string; p_user_id: string }; Returns: undefined };
      auth_mfa_satisfied: { Args: Record<PropertyKey, never>; Returns: boolean };
      can_view_avatar: { Args: { p_owner: string; p_viewer: string }; Returns: boolean };
      can_view_story: { Args: { p_owner: string; p_viewer: string }; Returns: boolean };
      compute_message_preview: {
        Args: {
          m: Omit<
            Database["public"]["Tables"]["messages"]["Row"],
            Database["public"]["Tables"]["messages"]["ComputedFields"]
          >;
        };
        Returns: string;
      };
      consume_backup_code: {
        Args: { p_challenge_id: string; p_code_hash: string; p_user_id: string };
        Returns: boolean;
      };
      create_channel: {
        Args: { p_description: string; p_name: string; p_slug: string };
        Returns: string;
      };
      create_community: { Args: { p_description: string; p_name: string }; Returns: string };
      create_direct_chat_request: {
        Args: { p_initial_content: string; p_target_user_id: string };
        Returns: string;
      };
      create_group_chat: { Args: { p_member_ids: string[]; p_name: string }; Returns: string };
      create_self_chat: { Args: Record<PropertyKey, never>; Returns: string };
      delete_message_for_everyone: { Args: { p_message_id: string }; Returns: undefined };
      follow_channel: { Args: { p_channel_id: string }; Returns: undefined };
      get_my_storage_usage: { Args: Record<PropertyKey, never>; Returns: number };
      has_read_receipts_enabled: { Args: { p_user_id: string }; Returns: boolean };
      is_blocked: { Args: { p_blocked: string; p_blocker: string }; Returns: boolean };
      is_blocked_either_way: { Args: { p_user_a: string; p_user_b: string }; Returns: boolean };
      is_channel_follower: { Args: { p_channel_id: string; p_user_id: string }; Returns: boolean };
      is_channel_owner: { Args: { p_channel_id: string; p_user_id: string }; Returns: boolean };
      is_chat_active: { Args: { p_chat_id: string }; Returns: boolean };
      is_chat_admin: { Args: { p_chat_id: string; p_user_id: string }; Returns: boolean };
      is_chat_member: { Args: { p_chat_id: string; p_user_id: string }; Returns: boolean };
      is_community_member: {
        Args: { p_community_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_contact: { Args: { p_user_a: string; p_user_b: string }; Returns: boolean };
      is_message_deleted_for_user: {
        Args: { p_message_id: string; p_user_id: string };
        Returns: boolean;
      };
      join_community: { Args: { p_community_id: string }; Returns: undefined };
      mark_chat_as_read: { Args: { p_chat_id: string }; Returns: undefined };
      reject_chat_request: { Args: { p_request_id: string }; Returns: undefined };
      replace_backup_codes: { Args: { p_hashes: string[]; p_user_id: string }; Returns: undefined };
    };
    Enums: {
      accent_theme: "blue" | "purple" | "red" | "orange" | "yellow" | "green";
      call_status: "ringing" | "answered" | "missed" | "declined" | "canceled" | "failed";
      call_type: "voice" | "video";
      chat_member_role: "admin" | "member";
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      accent_theme: ["blue", "purple", "red", "orange", "yellow", "green"],
      call_status: ["ringing", "answered", "missed", "declined", "canceled", "failed"],
      call_type: ["voice", "video"],
      chat_member_role: ["admin", "member"],
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
