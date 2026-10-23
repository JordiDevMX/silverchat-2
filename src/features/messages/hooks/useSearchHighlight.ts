import { useCallback, useEffect, useRef, useState } from "react";
export function useSearchHighlight() {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const frame = useRef(0);
  const clear = useCallback(() => {
    clearTimeout(timeout.current);
    cancelAnimationFrame(frame.current);
    setHighlightedId(null);
  }, []);
  const highlight = useCallback(
    (id: string) => {
      clear();
      frame.current = requestAnimationFrame(() => {
        setHighlightedId(id);
        timeout.current = setTimeout(() => setHighlightedId(null), 2000);
      });
    },
    [clear],
  );
  useEffect(
    () => () => {
      clearTimeout(timeout.current);
      cancelAnimationFrame(frame.current);
    },
    [],
  );
  return { highlightedId, highlight, clear };
}
