import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type ChatMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  separator?: boolean;
  trailing?: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
};
/** Coordinate-based menu shared by header/context-menu adapters; selection never waits for motion. */
export function ChatMenuSurface({
  label,
  point,
  items,
  onClose,
}: {
  label: string;
  point: { x: number; y: number };
  items: ChatMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onClose);
  callback.current = onClose;
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const openedAt = useRef(point);
  useLayoutEffect(() => {
    if (openedAt.current === point) return;
    openedAt.current = point;
    // A fresh open can replace an exiting menu at the same coordinates.
    closingRef.current = false;
    clearTimeout(timer.current);
    setClosing(false);
  }, [point]);
  useLayoutEffect(() => {
    const position = () => {
      const el = ref.current;
      if (!el) return;
      el.style.setProperty(
        "--menu-left",
        `${Math.max(8, Math.min(point.x, innerWidth - el.offsetWidth - 8))}px`,
      );
      el.style.setProperty(
        "--menu-top",
        `${Math.max(8, Math.min(point.y, innerHeight - el.offsetHeight - 8))}px`,
      );
    };
    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [point.x, point.y]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const close = (instant = false) => {
      if (closingRef.current) return;
      closingRef.current = true;
      if (instant || matchMedia("(prefers-reduced-motion: reduce)").matches) {
        callback.current();
        return;
      }
      setClosing(true);
      timer.current = setTimeout(() => callback.current(), 180);
    };
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "Tab") {
        close(true);
        return;
      }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const buttons = [
          ...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
        ];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? buttons.length - 1
              : (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length
        ]?.focus();
      }
    };
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      if (preference.matches && closingRef.current) {
        clearTimeout(timer.current);
        callback.current();
      }
    };
    preference.addEventListener("change", change);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(timer.current);
      preference.removeEventListener("change", change);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    if (!closing && openedAt.current === point)
      ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [closing, point]);
  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className="chat-options-menu chat-options-menu-v2"
      data-closing={closing || undefined}
      inert={closing}
      style={{ "--menu-left": `${point.x}px`, "--menu-top": `${point.y}px` } as CSSProperties}
    >
      {items.map((item) => (
        <div key={item.key} role="none">
          {item.separator && <hr />}
          <button
            role="menuitem"
            type="button"
            disabled={item.disabled}
            className={item.destructive ? "danger" : ""}
            onClick={item.onSelect}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.trailing}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
