import { create } from "zustand";
import { type ToastTone, toastStore } from "../../../lib/toast-store.ts";
import { reactionNotificationStore } from "../../chats/utils/reactionNotifications.ts";

export type ChatModal =
  | { kind: "contact" | "block"; userId: string; name?: string }
  | { kind: "menu"; x: number; y: number }
  | { kind: "photo" | "mute" | "add" | "clear" | "leave" };

export type NoticeAction = {
  kind: "reaction";
  href: string;
  chatId: string;
  messageId: string;
};

export interface NotifyOptions {
  id?: string;
  tone?: ToastTone;
  durationMs?: number;
}

export const useChatUIStore = create<{
  chatId: string | null;
  modal: ChatModal | null;
  notice: string;
  noticeAction: NoticeAction | null;
  activeToastId: string | null;
  open: (chatId: string, modal: ChatModal) => void;
  close: () => void;
  notify: (notice: string, action?: NoticeAction | null, options?: NotifyOptions) => void;
}>((set, get) => ({
  chatId: null,
  modal: null,
  notice: "",
  noticeAction: null,
  activeToastId: null,
  open: (chatId, modal) => set({ chatId, modal }),
  close: () => set({ chatId: null, modal: null }),
  notify: (notice, action, options) => {
    const trimmed = notice.trim();
    if (!trimmed) {
      const prevId = get().activeToastId;
      if (prevId) {
        toastStore.getState().dismiss(prevId, { immediate: true });
      }
      set({ notice: "", noticeAction: null, activeToastId: null });
      return;
    }

    const resolvedAction = action ?? null;
    const isReaction = resolvedAction?.kind === "reaction";
    const toastId =
      options?.id ??
      (isReaction ? `reaction:${resolvedAction.chatId}:${resolvedAction.messageId}` : undefined);

    const shownId = toastStore.getState().show({
      id: toastId,
      message: trimmed,
      tone: options?.tone ?? "info",
      durationMs: options?.durationMs,
      action: resolvedAction,
      onDismiss: () => {
        if (isReaction) {
          const active = reactionNotificationStore.getState();
          if (
            active.activeToastChatId === resolvedAction.chatId &&
            active.activeToastMessageId === resolvedAction.messageId
          ) {
            active.setActiveToast(null, null);
          }
        }
        if (get().activeToastId === shownId) {
          set({ notice: "", noticeAction: null, activeToastId: null });
        }
      },
    });

    set({ notice: trimmed, noticeAction: resolvedAction, activeToastId: shownId });
  },
}));
