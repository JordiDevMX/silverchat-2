import {
  Ban,
  Bell,
  BellOff,
  ChevronRight,
  Flag,
  Info,
  Link,
  LogOut,
  Mail,
  Minus,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { ChatMenuSurface } from "@/components/ui/chat-menu-surface";
import { useMessageText } from "@/features/messages/i18n";
import type { ChatDetails } from "@/features/messages/types";
import {
  type ChannelAction,
  type ChannelActionContext,
  type ChatAction,
  getAvailableChannelActions,
  getAvailableChatActions,
} from "../lib/chatActions";

type MenuProps = {
  point: { x: number; y: number };
  onClose: () => void;
  busy?: boolean;
} & (
  | {
      contextType?: "chat" | "community_chat";
      chat: ChatDetails;
      onChoose: (action: ChatAction) => void;
    }
  | {
      contextType: "channel";
      channel: ChannelActionContext;
      onChoose: (action: ChannelAction) => void;
    }
);
export function ChatOptionsMenu(props: MenuProps) {
  const { point, onClose, busy } = props;
  const actions =
    props.contextType === "channel"
      ? getAvailableChannelActions(props.channel).map((action) => ({
          action,
          choose: () => props.onChoose(action),
        }))
      : getAvailableChatActions(props.chat).map((action) => ({
          action,
          choose: () => props.onChoose(action),
        }));
  const { say } = useMessageText();
  const labels: Record<ChatAction | ChannelAction, string> = {
    view_channel_info: say("Channel info", "Información del canal"),
    follow: say("Follow", "Seguir"),
    unfollow: say("Unfollow", "Dejar de seguir"),
    copy_channel_link: say("Copy channel link", "Copiar enlace del canal"),
    view_profile: say("View profile", "Ver perfil"),
    view_group_info: say("Group info", "Información del grupo"),
    view_community_info: say("Community info", "Información de la comunidad"),
    search_in_chat: say("Search in chat", "Buscar en el chat"),
    mute: say("Mute", "Silenciar"),
    unmute: say("Unmute", "Activar sonido"),
    mark_unread: say("Mark as unread", "Marcar como no leído"),
    pin: say("Pin", "Fijar"),
    unpin: say("Unpin", "Desfijar"),
    clear_chat: say("Clear chat", "Vaciar chat"),
    block: say("Block", "Bloquear"),
    report: say("Report", "Reportar"),
    view_members: say("View members", "Ver miembros"),
    add_members: say("Add members", "Añadir miembros"),
    leave_group: say("Leave group", "Salir del grupo"),
  };
  const icons = {
    view_channel_info: Info,
    follow: Plus,
    unfollow: Minus,
    copy_channel_link: Link,
    view_profile: UserRound,
    view_group_info: Info,
    view_community_info: Info,
    search_in_chat: Search,
    mute: BellOff,
    unmute: Bell,
    mark_unread: Mail,
    pin: Pin,
    unpin: PinOff,
    clear_chat: Trash2,
    block: Ban,
    report: Flag,
    view_members: Users,
    add_members: UserPlus,
    leave_group: LogOut,
  };
  return (
    <ChatMenuSurface
      label={
        props.contextType === "channel"
          ? say("Channel options", "Opciones del canal")
          : say("Chat options", "Opciones del chat")
      }
      point={point}
      onClose={onClose}
      items={actions.map(({ action, choose }) => {
        const Icon = icons[action];
        return {
          key: action,
          label: labels[action],
          icon: <Icon size={17} aria-hidden="true" />,
          trailing: action === "mute" ? <ChevronRight size={15} aria-hidden="true" /> : undefined,
          destructive: ["block", "leave_group", "clear_chat"].includes(action),
          disabled: busy,
          separator:
            ["block", "view_members", "leave_group"].includes(action) ||
            (props.contextType !== "channel" &&
              props.chat.type === "self" &&
              action === "clear_chat"),
          onSelect: choose,
        };
      })}
    />
  );
}
