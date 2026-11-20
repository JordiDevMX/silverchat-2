import type { ReactNode } from "react";
import { Modal } from "@/components/ui/modal";

/** Fullscreen native-dialog shell shared by all call modals (8/10/11/12).
 * Styling lives in src/styles/calls.css under dialog.call-modal. */
export function CallModalShell({
  title,
  onClose,
  children,
  className,
}: {
  title: string;
  /** Escape behavior per modal: decline (incoming), cancel (outgoing), or a
   * no-op for active calls where Escape must not end the call. */
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Modal title={title} onClose={onClose} className={`call-modal ${className ?? ""}`}>
      <div className="call-modal-body">{children}</div>
    </Modal>
  );
}
