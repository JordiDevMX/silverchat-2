import { Info, Plus } from "lucide-react";
import { useState } from "react";
import { useMessageText } from "@/features/messages/i18n";
import { NavLink, QueryState } from "@/features/settings/components/shared";
import { useCommunityChats } from "../hooks/useCommunityChats";
import type { Community } from "../types";
import { CommunityChatListItem } from "./CommunityChatListItem";
import { CreateCommunityChatModal } from "./CreateCommunityChatModal";
export function CommunityChatSidebar({
  community,
  activeChatId,
}: {
  community: Community;
  activeChatId?: string;
}) {
  const { say } = useMessageText();
  const chats = useCommunityChats(community.id);
  const [create, setCreate] = useState(false);
  return (
    <aside className="community-sidebar">
      <header className="community-sidebar-header">
        <NavLink className="text-sm text-primary" href="/communities">
          ← {say("Communities", "Comunidades")}
        </NavLink>
        <h1 className="w-full truncate text-lg font-semibold">{community.name}</h1>
        <p className="text-xs text-muted-foreground">
          {community.member_count} {say("members", "miembros")}
        </p>
      </header>
      <nav
        className="min-h-0 flex-1 overflow-y-auto"
        aria-label={say("Community chats", "Chats de la comunidad")}
      >
        <QueryState
          loading={chats.isPending}
          error={chats.error}
          retry={() => void chats.refetch()}
        />
        {chats.data?.map((chat) => (
          <CommunityChatListItem key={chat.id} chat={chat} isActive={chat.id === activeChatId} />
        ))}
        {chats.isSuccess && !chats.data.length && (
          <p className="p-4 text-muted-foreground">{say("No chats yet", "Aún no hay chats")}</p>
        )}
        {community.role === "admin" && (
          <button type="button" className="community-new-chat" onClick={() => setCreate(true)}>
            <Plus size={18} />
            {say("New chat", "Nuevo chat")}
          </button>
        )}
      </nav>
      <footer className="community-sidebar-footer">
        <NavLink className="flex items-center gap-2" href={`/communities/${community.id}/info`}>
          <Info size={18} />
          {say("Community info", "Información de la comunidad")}
        </NavLink>
      </footer>
      {create && community.role === "admin" && (
        <CreateCommunityChatModal communityId={community.id} onClose={() => setCreate(false)} />
      )}
    </aside>
  );
}
