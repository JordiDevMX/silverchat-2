import { create } from "zustand";
export type ChatModal =
  | { kind: "contact" | "report" | "block"; userId: string; name?: string }
  | { kind: "menu"; x: number; y: number }
  | { kind: "mute" | "add" | "clear" | "leave" };
export const useChatUIStore = create<{
  chatId: string | null;
  modal: ChatModal | null;
  notice: string;
  open: (chatId: string, modal: ChatModal) => void;
  close: () => void;
  notify: (notice: string) => void;
}>((set) => ({
  chatId: null,
  modal: null,
  notice: "",
  open: (chatId, modal) => set({ chatId, modal }),
  close: () => set({ chatId: null, modal: null }),
  notify: (notice) => set({ notice }),
}));
