import { type ReactNode, useEffect, useRef, useState } from "react";
import { Modal } from "./modal";

/** Shared native-dialog motion. Legacy story styling hooks remain compatible.
 * Local exit presence; children can pause functional work immediately on closing. */
export function MotionOverlay({
  title,
  className = "",
  onClose,
  children,
  canClose = true,
  onDismiss,
}: {
  title: string;
  className?: string;
  onClose: () => void;
  canClose?: boolean;
  onDismiss?: () => void;
  children: (close: () => void, closing: boolean) => ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const callback = useRef(onClose);
  callback.current = onClose;
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    callback.current();
  };
  const close = () => {
    if (closingRef.current || !canClose) return;
    closingRef.current = true;
    onDismiss?.();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
    else setClosing(true);
  };
  useEffect(() => {
    if (!closing) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const finishExit = () => {
      if (!done.current) {
        done.current = true;
        callback.current();
      }
    };
    const motionChanged = () => {
      if (preference.matches) finishExit();
    };
    preference.addEventListener("change", motionChanged);
    // Safety fallback if an animation is cancelled or its stylesheet cannot load.
    const timer = setTimeout(finishExit, 250);
    return () => {
      clearTimeout(timer);
      preference.removeEventListener("change", motionChanged);
    };
  }, [closing]);
  return (
    <Modal
      title={title}
      onClose={canClose ? close : undefined}
      className={`motion-overlay story-overlay ${className} ${closing ? "story-exiting" : ""}`}
    >
      <div
        className="motion-overlay-body story-overlay-body"
        data-closing={closing || undefined}
        inert={closing}
        onAnimationEnd={(event) => {
          if (closing && event.target === event.currentTarget) finish();
        }}
      >
        {children(close, closing)}
      </div>
    </Modal>
  );
}
