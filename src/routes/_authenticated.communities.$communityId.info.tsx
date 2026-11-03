import { useParams } from "@tanstack/react-router";
import { CommunityInfoScreen } from "@/features/communities/components/CommunityInfoScreen";
export function CommunityInfoPage() {
  const { communityId } = useParams({ from: "/_authenticated/communities/$communityId/info" });
  return <CommunityInfoScreen communityId={communityId} />;
}
