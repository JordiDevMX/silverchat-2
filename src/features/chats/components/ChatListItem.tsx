import type { ComponentProps } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { Avatar } from "@/features/settings/components/shared";
import { useChatText } from "../i18n";
import { ChatListItemSurface } from "./ChatListItemSurface";

export function ChatListItem(
  props: Omit<ComponentProps<typeof ChatListItemSurface>, "avatar" | "t" | "language">,
) {
  const t = useChatText();
  const { language } = useI18n();
  const { chat } = props;
  return (
    <ChatListItemSurface
      {...props}
      t={t}
      language={language}
      avatar={
        <Avatar
          profile={{
            id: chat.otherUserId ?? chat.id,
            display_name: chat.displayName,
            avatar_url: chat.avatarUrl,
            initials: chat.avatarInitials,
          }}
        />
      }
    />
  );
}
