import { useEffect, useRef, useState } from "react";

export function useStoryTimer(
  duration: number,
  onComplete: () => void,
  isPaused: boolean,
  resetKey?: string,
) {
  const [state, setState] = useState<{ key: string | undefined; progress: number }>({
    key: resetKey,
    progress: 0,
  });
  const elapsed = useRef(0);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const fired = useRef(false);
  const lastResetKey = useRef(resetKey);

  if (lastResetKey.current !== resetKey) {
    lastResetKey.current = resetKey;
    elapsed.current = 0;
    fired.current = false;
  }

  useEffect(() => {
    elapsed.current = 0;
    fired.current = false;
    setState({ key: resetKey, progress: 0 });
  }, [resetKey]);

  useEffect(() => {
    if (isPaused || fired.current) return;
    let frame = 0;
    let previous: number | undefined;
    const tick = (now: number) => {
      if (previous !== undefined) elapsed.current += now - previous;
      previous = now;
      const nextProgress = Math.min(1, elapsed.current / duration);
      setState({ key: resetKey, progress: nextProgress });
      if (elapsed.current >= duration) {
        fired.current = true;
        complete.current();
      } else {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, isPaused, resetKey]);

  return state.key === resetKey ? state.progress : 0;
}
