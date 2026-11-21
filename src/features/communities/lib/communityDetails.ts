import type { ChatDetails } from "../../messages/types.ts";
import type { Community, CommunityMember } from "../types.ts";
// Adapter for the shared settings/member surfaces; never used for message requests.
export function communityDetails(
  community: Community,
  members: CommunityMember[],
  userId: string,
): ChatDetails {
  const mapped = members.map((member) => ({
    ...member,
    role: (member.role === "admin" ? "admin" : "member") as "admin" | "member",
    chat_id: community.id,
    last_read_at: null,
    muted_until: null,
    pinned_at: null,
    archived_at: null,
    favorited_at: null,
    manually_unread: false,
  }));
  return {
    id: community.id,
    type: "community_chat",
    status: "active",
    name: community.name,
    description: community.description,
    avatar: community.avatar_url,
    createdAt: community.created_at,
    createdBy: community.owner_id,
    communityOwnerId: community.owner_id,
    communityRole:
      community.owner_id === userId
        ? "owner"
        : community.role === "admin"
          ? "admin"
          : community.role === "moderator"
            ? "moderator"
            : "member",
    members: mapped,
    own: {
      chat_id: community.id,
      user_id: userId,
      role: community.role === "admin" ? "admin" : "member",
      joined_at: community.joined_at,
      last_read_at: null,
      muted_until: null,
      pinned_at: null,
      archived_at: null,
      favorited_at: null,
      manually_unread: false,
    },
    communityId: community.id,
    communityName: community.name,
    readOnly: false,
  };
}
