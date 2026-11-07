import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/app/providers/i18n-provider";
import { useAuth } from "@/lib/auth-provider";
import { blockUser } from "../hooks";
import { useAction } from "./useAction";
export function useBlockUser(targetId: string, onClose: () => void) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const action = useAction();
  const { t, language } = useI18n();
  const block = () =>
    action.run(async () => {
      if (!user) return;
      await blockUser(targetId, user.id);
      await Promise.all(
        ["blocked", "contacts", "public-profile", "avatar-url", "chats"].map((key) =>
          cache.invalidateQueries({ queryKey: [key] }),
        ),
      );
      onClose();
    });
  return { user, action, t, language, block };
}
