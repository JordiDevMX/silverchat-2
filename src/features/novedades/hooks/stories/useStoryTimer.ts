import { useEffect, useRef, useState } from "react";
export function useStoryTimer(duration: number, onComplete: () => void, isPaused: boolean) {
  const [progress, setProgress] = useState(0);
  const elapsed = useRef(0);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const fired = useRef(false);
  useEffect(() => {
    if (isPaused || fired.current) return;
    let frame = 0;
    let previous: number | undefined;
    const tick = (now: number) => {
      if (previous !== undefined) elapsed.current += now - previous;
      previous = now;
      setProgress(Math.min(1, elapsed.current / duration));
      if (elapsed.current >= duration) {
        fired.current = true;
        complete.current();
      } else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, isPaused]);
  return progress;
}
