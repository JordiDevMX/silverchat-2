import { GroupSettingsScreen } from "@/features/chat-settings/components/GroupSettingsScreen";
export function CommunityInfoScreen({ communityId }: { communityId: string }) {
  return (
    <div className="community-info">
      <GroupSettingsScreen context="community" communityId={communityId} />
    </div>
  );
}
