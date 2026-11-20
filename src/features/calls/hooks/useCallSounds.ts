// Ringtone / calling-tone playback (7.3, L2). One looped <audio> per ringing
// phase; autoplay may be blocked before first user interaction — the warning
// is non-fatal and the modal still shows.
import { useEffect, useRef } from "react";
import type { CallPhase } from "../types";

export function useCallSounds(phase: CallPhase) {
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (phase !== "incoming-ringing" && phase !== "outgoing-ringing") return;
    const source = phase === "incoming-ringing" ? "/sounds/ringtone.mp3" : "/sounds/calling.mp3";
    const element = new Audio(source);
    element.loop = true;
    element.volume = phase === "incoming-ringing" ? 0.8 : 0.6;
    element.preload = "auto";
    audio.current = element;
    void element.play().catch((error) => {
      console.warn(`[calls] ${source} autoplay blocked:`, error);
    });
    return () => {
      element.pause();
      element.src = "";
      audio.current = null;
    };
  }, [phase]);

  // Preload both tones once so the first ring is not delayed by fetching.
  useEffect(() => {
    for (const source of ["/sounds/ringtone.mp3", "/sounds/calling.mp3"]) {
      const preload = new Audio(source);
      preload.preload = "auto";
      preload.load();
    }
  }, []);
}
