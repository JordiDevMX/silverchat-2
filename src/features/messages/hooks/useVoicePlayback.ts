import { useEffect, useRef, useState } from "react";
import { useAudioStore } from "../stores/audioStore";
export function useVoicePlayback(id: string) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => () => useAudioStore.getState().stop(id), [id]);
  return {
    ref,
    playing,
    position,
    duration,
    error,
    play: async () => {
      if (!ref.current) return;
      try {
        await useAudioStore.getState().play(id, ref.current);
        setError(false);
      } catch {
        setError(true);
      }
    },
    seek: (seconds: number) => {
      if (ref.current) ref.current.currentTime = seconds;
      setPosition(seconds);
    },
    audioProps: {
      onPlay: () => setPlaying(true),
      onPause: () => setPlaying(false),
      onEnded: () => useAudioStore.getState().stop(id),
      onTimeUpdate: () => setPosition(ref.current?.currentTime ?? 0),
      onLoadedMetadata: () => {
        const value = ref.current?.duration;
        if (value && Number.isFinite(value)) setDuration(value);
      },
      onError: () => setError(true),
    },
  };
}
