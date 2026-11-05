import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useRef } from "react";
import { formatDirectChatError } from "@/features/chats/hooks/useCreateDirectChat";
import { useMessageText } from "@/features/messages/i18n";
import type { ChatDetails } from "@/features/messages/types";
import { useAction } from "@/features/settings/hooks/useAction";
import { useAvatarGradient } from "@/features/settings/hooks/useAvatar";
import { useAuth } from "@/lib/auth-provider";
import { FIXED_PLATFORMS, normalizeSocialLinks } from "@/lib/social-links";
import { supabase } from "@/lib/supabase";
import { useChatUIStore } from "../stores/uiStore";
import { useContactProfile } from "./useContactProfile";
export function useContactProfileActions(userId: string, chat: ChatDetails) {
  const query = useContactProfile(userId);
  const queryClient = useQueryClient();
  const p = query.data?.profile;
  const { say, language } = useMessageText();
  const ui = useChatUIStore();
  const router = useRouter();
  const action = useAction();
  const { user } = useAuth();
  const gradient = useAvatarGradient(userId);
  const social = normalizeSocialLinks(p?.social_links);
  const links = [
    ...FIXED_PLATFORMS.flatMap((platform) =>
      social[platform.key] ? [{ label: platform.label, url: social[platform.key] ?? "" }] : [],
    ),
    ...(social.custom ?? []),
  ];
  const last = p?.last_seen_at;
  const active =
    (chat.type === "direct" && chat.otherUserId === userId
      ? chat.status
      : query.data?.chat?.status) === "active";

  const inFlight = useRef<Promise<void> | null>(null);
  const sendMessage = () => {
    if (inFlight.current) return inFlight.current;
    const pending = action
      .run(async () => {
        const existingChat =
          chat.type === "direct" && chat.otherUserId === userId
            ? { id: chat.id, status: chat.status }
            : query.data?.chat;
        let id =
          existingChat?.status === "active" || existingChat?.status === "pending_request"
            ? existingChat.id
            : undefined;
        if (!id) {
          const result =
            userId === user?.id
              ? await supabase.rpc("create_self_chat")
              : await supabase.rpc("create_direct_chat_request", {
                  p_target_user_id: userId,
                  p_initial_content: "👋",
                });
          if (result.error) {
            throw new Error(formatDirectChatError(result.error, language));
          }
          id = result.data;
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["chats"] }),
            queryClient.invalidateQueries({ queryKey: ["direct-contacts"] }),
            queryClient.invalidateQueries({ queryKey: ["contacts"] }),
            queryClient.invalidateQueries({ queryKey: ["message-requests"] }),
            queryClient.invalidateQueries({ queryKey: ["contact-profile"] }),
          ]);
        }
        ui.close();
        await router.navigate({ href: `/chats/${id}` });
      })
      .finally(() => {
        inFlight.current = null;
      });
    inFlight.current = pending;
    return pending;
  };
  const viewFullProfile = () => {
    ui.close();
    void router.navigate({ href: `/profile/${encodeURIComponent(p?.username ?? "")}` });
  };
  return {
    query,
    p,
    say,
    language,
    ui,
    action,
    user,
    gradient,
    links,
    last,
    active,
    sendMessage,
    viewFullProfile,
  };
}
