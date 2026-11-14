import { useQueryClient } from "@tanstack/react-query";
import { refreshChatSettings } from "@/features/chat-settings/lib/cache";
import { saveGroupAvatar } from "@/features/chat-settings/lib/groupAvatar";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { useMessageText } from "@/features/messages/i18n";
import type { ChatDetails } from "@/features/messages/types";
import { AvatarPickerModal } from "@/features/settings/components/AvatarPickerModal";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";

export function CommunityChatPhotoPicker({
  chat,
  onClose,
}: {
  chat: ChatDetails;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const { user } = useAuth();
  const { say } = useMessageText();
  const notify = useChatUIStore((s) => s.notify);
  if (!user) return null;
  return (
    <AvatarPickerModal
      profile={{ id: chat.id, avatar_url: chat.avatar }}
      onClose={onClose}
      onSave={async (file) => {
        const result = await saveGroupAvatar(chat.id, user.id, file, chat.avatar, async (patch) => {
          const { error } = await supabase.rpc("update_community_chat_avatar", {
            p_chat_id: chat.id,
            p_avatar_url: patch.avatar_url,
          });
          if (error) throw error;
        });
        await refreshChatSettings(cache, user.id, chat.id);
        return result;
      }}
      onSaved={(warning) =>
        notify(
          warning
            ? say(
                "Photo saved. Old photo cleanup is pending.",
                "Foto guardada. La limpieza de la foto anterior está pendiente.",
              )
            : say("Chat photo updated", "Foto del chat actualizada"),
        )
      }
    />
  );
}
