import { ChevronDown, ChevronUp } from "lucide-react";
import { useId, useState } from "react";
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
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-3 p-4 text-left"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => {
          setExpanded(!expanded);
          try {
            localStorage.setItem(key, String(!expanded));
          } catch {
            /* Optional storage. */
          }
        }}
      >
        <Avatar
          profile={{
            id: community.id,
            display_name: community.name,
            avatar_url: community.avatar_url,
          }}
          size="small"
        />
        <span className="min-w-0 flex-1">
          <strong className="block truncate">{community.name}</strong>
          <span className="block truncate text-sm text-muted-foreground">
            {community.description}
          </span>
          <span className="text-xs text-muted-foreground">
            {community.member_count} {say("members", "miembros")}
          </span>
        </span>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      <div id={id} hidden={!expanded}>
        {expanded && (
          <>
            <QueryState
              loading={chats.isPending}
              error={chats.error}
              retry={() => void chats.refetch()}
            />
            {chats.data?.slice(0, 3).map((chat) => (
              <CommunityChatListItem key={chat.id} chat={chat} />
            ))}
            <NavLink
              className="block p-4 text-center text-sm text-primary"
              href={`/communities/${community.id}`}
            >
              {say(
                `See all ${chats.data?.length ?? ""} chats →`,
                `Ver los ${chats.data?.length ?? ""} chats →`,
              )}
            </NavLink>
          </>
        )}
      </div>
    </article>
  );
}
