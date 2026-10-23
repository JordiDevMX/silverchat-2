import { create } from "zustand";

interface AudioStore {
  currentId: string | null;
  currentAudio: HTMLAudioElement | null;
  play: (id: string, audio: HTMLAudioElement) => Promise<void>;
  stop: (id?: string) => void;
}
export const useAudioStore = create<AudioStore>((set, get) => ({
  currentId: null,
  currentAudio: null,
  play: async (id, audio) => {
    const old = get();
    if (old.currentAudio === audio && !audio.paused) {
      audio.pause();
      return;
    }
    if (old.currentAudio && old.currentAudio !== audio) {
      old.currentAudio.pause();
      old.currentAudio.currentTime = 0;
    }
    set({ currentId: id, currentAudio: audio });
    try {
      await audio.play();
      if (get().currentAudio !== audio) audio.pause();
    } catch (error) {
      if (get().currentAudio === audio) set({ currentId: null, currentAudio: null });
      throw error;
    }
  },
  stop: (id) => {
    const state = get();
    if (id && state.currentId !== id) return;
    state.currentAudio?.pause();
    if (state.currentAudio) state.currentAudio.currentTime = 0;
    set({ currentId: null, currentAudio: null });
  },
}));
