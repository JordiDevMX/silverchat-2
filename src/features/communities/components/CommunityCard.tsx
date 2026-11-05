import { useId, useState } from "react";
import { CommunityCardSurface } from "@/components/ui/community-surfaces";
import { useMessageText } from "@/features/messages/i18n";
import { Avatar, NavLink, QueryState } from "@/features/settings/components/shared";
import { useCommunityChats } from "../hooks/useCommunityChats";
import type { Community } from "../types";
import { CommunityChatListItem } from "./CommunityChatListItem";
export function CommunityCard({ community }: { community: Community }) {
  const key = `silverchat_community_expanded_${community.id}`;
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem(key) === "true";
    } catch {
      return false;
    }
  });
  const id = useId();
  const { say } = useMessageText();
  const chats = useCommunityChats(community.id, expanded);
  return (
    <CommunityCardSurface
      name={community.name}
      description={community.description}
      members={
        <>
          {community.member_count} {say("members", "miembros")}
        </>
      }
      avatar={
        <Avatar
          profile={{
            id: community.id,
            display_name: community.name,
            avatar_url: community.avatar_url,
          }}
          size="small"
        />
      }
      expanded={expanded}
      panelId={id}
      onToggle={() => {
        setExpanded(!expanded);
        try {
          localStorage.setItem(key, String(!expanded));
        } catch {
          /* Optional storage. */
        }
      }}
    >
      {/* Keep rows mounted for the closing transition; fetching still follows expanded. */}
      <QueryState
        loading={chats.isPending}
        error={chats.error}
        retry={() => void chats.refetch()}
      />
      {chats.data?.slice(0, 3).map((chat) => (
        <CommunityChatListItem key={chat.id} chat={chat} />
      ))}
      <NavLink className="community-view-all" href={`/communities/${community.id}`}>
        {say(
          `See all ${chats.data?.length ?? ""} chats →`,
          `Ver los ${chats.data?.length ?? ""} chats →`,
        )}
      </NavLink>
    </CommunityCardSurface>
  );
}
