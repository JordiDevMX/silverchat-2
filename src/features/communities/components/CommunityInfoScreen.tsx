import { GroupSettingsScreen } from "@/features/chat-settings/components/GroupSettingsScreen";
export function CommunityInfoScreen({ communityId }: { communityId: string }) {
  return <GroupSettingsScreen context="community" communityId={communityId} />;
}
