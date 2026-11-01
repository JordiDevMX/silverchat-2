import { FocusTrap } from "focus-trap-react";
import { type PropsWithChildren, useEffect, useRef, useState } from "react";
import { Modal } from "@/features/auth/components";

export function CreationDialog({
  title,
  onClose,
  paused = false,
  children,
}: PropsWithChildren<{ title: string; onClose?: () => void; paused?: boolean }>) {
  const [active, setActive] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  // Activate after showModal makes the shared dialog's controls visible.
  useEffect(() => setActive(true), []);
  return (
    <Modal title={title} onClose={onClose}>
      <FocusTrap
        active={active}
        paused={paused}
        focusTrapOptions={{
          escapeDeactivates: false,
          returnFocusOnDeactivate: false,
          fallbackFocus: () => container.current ?? document.body,
        }}
      >
        <div ref={container} tabIndex={-1}>
          {children}
        </div>
      </FocusTrap>
    </Modal>
  );
}
