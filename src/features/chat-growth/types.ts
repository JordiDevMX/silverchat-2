export type SupportedGrowthChatType = "channel" | "group" | "community_chat";

export type GrowthActionIcon = "share_status" | "plus" | "user_plus";

export interface GrowthActionSpec {
  id: "share_status" | "secondary_invite";
  label: string;
  icon: GrowthActionIcon;
}

export interface GrowthChatModel {
  type: SupportedGrowthChatType;
  id: string;
  name: string;
  avatarUrl: string | null;
  fallbackAvatarKind: SupportedGrowthChatType;
  title: string;
  subtitle: string;
  description: string | null;
  emptyDescriptionLabel: string;
  editDescriptionHref: string | null;
  isCreator: boolean;
  isOwnerOrAdmin: boolean;
  inviteUrl: string;
  storyPrefillText: string;
  primaryAction: GrowthActionSpec;
  secondaryAction: GrowthActionSpec;
}
