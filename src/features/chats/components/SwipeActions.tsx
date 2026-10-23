import { Archive, Check, Pin, VolumeX } from "lucide-react";
import { type PropsWithChildren, useRef, useState } from "react";
import { useChatText } from "../i18n";
import type { ChatAction } from "../types";
export function SwipeActions({
  children,
  disabled,
  onAction,
}: { disabled: boolean; onAction: (action: ChatAction) => void } & PropsWithChildren) {
  const t = useChatText();
  const [offset, setOffset] = useState(0);
  const start = useRef<{ x: number; y: number; horizontal: boolean } | null>(null);
  const delta = useRef(0);
  const suppress = useRef(false);
  const act = (action: ChatAction) => {
    setOffset(0);
    onAction(action);
  };
  return (
    <div
      className="chat-swipe"
      onTouchStart={(e) => {
        if (disabled || !window.matchMedia("(pointer: coarse)").matches) return;
        const touch = e.touches[0];
        if (touch) {
          start.current = { x: touch.clientX, y: touch.clientY, horizontal: false };
          delta.current = 0;
          suppress.current = false;
        }
      }}
      onTouchMove={(e) => {
        const touch = e.touches[0],
          origin = start.current;
        if (!touch || !origin) return;
        const dx = touch.clientX - origin.x,
          dy = touch.clientY - origin.y;
        if (!origin.horizontal && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
          start.current = null;
          return;
        }
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
          origin.horizontal = true;
          suppress.current = true;
          delta.current = dx;
          setOffset(Math.max(-200, Math.min(200, dx)));
        }
      }}
      onTouchEnd={() => {
        if (start.current?.horizontal) {
          const dx = delta.current;
          if (Math.abs(dx) >= 200 || Math.abs(dx) > 160 * 0.9) {
            act(dx < 0 ? "archive" : "pin");
            navigator.vibrate?.(15);
          } else setOffset(Math.abs(dx) > 160 * 0.4 ? (dx < 0 ? -160 : 160) : 0);
        }
        start.current = null;
      }}
      onTouchCancel={() => {
        start.current = null;
        setOffset(0);
      }}
      onClickCapture={(e) => {
        if (suppress.current) {
          e.preventDefault();
          e.stopPropagation();
          suppress.current = false;
        }
      }}
    >
      <div
        className={`chat-swipe-actions ${offset > 0 ? "swipe-left" : "swipe-right"}`}
        aria-hidden={!offset}
        inert={!offset}
      >
        {(offset > 0
          ? ([
              [Pin, "Pin", "pin"],
              [Check, "Mark as read", "read"],
            ] as const)
          : ([
              [Archive, "Archive", "archive"],
              [VolumeX, "Mute", "mute"],
            ] as const)
        ).map(([Icon, label, action]) => (
          <button
            key={action}
            type="button"
            disabled={disabled}
            onClick={() => act(action)}
            onTouchEnd={(event) => {
              // Some mobile browsers suppress the compatibility click after a
              // swipe. Handle a deliberate action tap once, without that click.
              if (start.current && !start.current.horizontal) {
                event.preventDefault();
                start.current = null;
                suppress.current = false;
                act(action);
              }
            }}
          >
            <Icon size={20} />
            {t(label)}
          </button>
        ))}
      </div>
      <div className="chat-swipe-content" style={{ transform: `translateX(${offset}px)` }}>
        {children}
      </div>
    </div>
  );
}
