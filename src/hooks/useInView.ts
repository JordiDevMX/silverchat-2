import { type RefObject, useEffect, useState } from "react";

export function useInView(
  ref: RefObject<Element | null>,
  options?: IntersectionObserverInit,
): boolean {
  const rootMargin = options?.rootMargin ?? "100px";
  const threshold = options?.threshold;
  const root = options?.root ?? null;
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === element) {
            setInView(entry.isIntersecting);
          }
        }
      },
      { root, rootMargin, threshold },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, root, rootMargin, threshold]);

  return inView;
}
