import {
  Archive,
  Ban,
  CheckCheck,
  MessageSquare,
  Search,
  Star,
  Users,
  VolumeX,
} from "lucide-react";
import { useChatText } from "../i18n";
import type { FilterKey } from "../types";

const states = {
  all: [MessageSquare, "No chats yet", "Start a conversation with someone.", "New chat"],
  favorites: [Star, "No favorite chats", "Long-press any chat to favorite it.", null],
  unread: [CheckCheck, "You’re all caught up!", "No unread messages.", null],
  groups: [Users, "No groups yet", "Create a group or wait to be added.", "New group"],
  archived: [Archive, "No archived chats", "Chats you archive will appear here.", null],
  muted: [VolumeX, "No muted chats", "Chats you mute will appear here.", null],
  blocked: [
    Ban,
    "You haven’t blocked anyone",
    "Blocked contacts won’t be able to message you.",
    null,
  ],
} as const;
export function ChatsEmptyState({
  filter,
  query,
  onNew,
}: {
  filter: FilterKey;
  query: string;
  onNew: () => void;
}) {
  const t = useChatText();
  const [Icon, title, subtitle, cta] = states[filter];
  return (
    <div className="chats-empty">
      {query ? <Search size={48} /> : <Icon size={48} />}
      <h2>
        {query ? t(`No chats match “${query}”`, `Ningún chat coincide con “${query}”`) : t(title)}
      </h2>
      <p>{query ? t("Try another search.", "Prueba otra búsqueda.") : t(subtitle)}</p>
      {!query && cta && (
        <button className="button primary" type="button" onClick={onNew}>
          {t(cta)}
        </button>
      )}
    </div>
  );
}
