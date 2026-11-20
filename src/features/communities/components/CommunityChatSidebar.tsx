import "@/styles/communities.css";
import { Plus } from "lucide-react";
import { useState } from "react";
import { SearchField } from "@/components/ui/search-field";
import { SidebarActions } from "@/features/chats/components/SidebarActions";
import { useMessageText } from "@/features/messages/i18n";
import { QueryState } from "@/features/settings/components/shared";
import { useCommunityChats } from "../hooks/useCommunityChats";
import type { Community } from "../types";
import { CommunityChatListItem } from "./CommunityChatListItem";
export function CommunityChatSidebar({
  community,
  activeChatId,
}: {
  community: Community;
  activeChatId?: string;
}) {
  const { say } = useMessageText();
  const chats = useCommunityChats(community.id);
  const [, setCreate] = useState(false);
  const [filter, setFilter] = useState("");
  const visible = chats.data?.filter((chat) =>
    chat.name?.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()),
  );
  return (
    <aside className="community-sidebar">
      <SidebarActions />
      <SearchField
        className="chat-search"
        label={community.name}
        clearLabel={say("Clear search", "Borrar búsqueda")}
        value={filter}
        onChange={setFilter}
        onClear={() => setFilter("")}
      />
      <nav
        className="min-h-0 flex-1 overflow-y-auto"
        aria-label={say("Community chats", "Chats de la comunidad")}
      >
        <QueryState
          loading={chats.isPending}
          error={chats.error}
          retry={() => void chats.refetch()}
        />
        {visible?.map((chat) => (
          <CommunityChatListItem key={chat.id} chat={chat} isActive={chat.id === activeChatId} />
        ))}
        {chats.isSuccess && !chats.data.length && (
          <p className="p-4 text-muted-foreground">{say("No chats yet", "Aún no hay chats")}</p>
        )}
        {chats.isSuccess && !!chats.data.length && !visible?.length && (
          <p className="p-4 text-muted-foreground">
            {say("No matching chats", "No hay chats coincidentes")}
          </p>
        )}
        {community.role === "admin" && (
          <button type="button" className="community-new-chat" onClick={() => setCreate(true)}>
            <Plus size={18} />
            {say("New chat", "Nuevo chat")}
          </button>
        )}
      </nav>
    </aside>
  );
}
