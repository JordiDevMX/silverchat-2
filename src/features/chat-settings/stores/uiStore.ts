import { create } from "zustand";
export type ChatModal =
  | { kind: "contact" | "report" | "block"; userId: string; name?: string }
  | { kind: "menu"; x: number; y: number }
  | { kind: "photo" | "mute" | "add" | "clear" | "leave" };
export type NoticeAction = {
  kind: "reaction";
  href: string;
  chatId: string;
  messageId: string;
};
export const useChatUIStore = create<{
  chatId: string | null;
  modal: ChatModal | null;
  notice: string;
  noticeAction: NoticeAction | null;
  open: (chatId: string, modal: ChatModal) => void;
  close: () => void;
  notify: (notice: string, action?: NoticeAction | null) => void;
}>((set) => ({
  chatId: null,
  modal: null,
  notice: "",
  noticeAction: null,
  open: (chatId, modal) => set({ chatId, modal }),
  close: () => set({ chatId: null, modal: null }),
  notify: (notice, action) => set({ notice, noticeAction: action ?? null }),
}));
