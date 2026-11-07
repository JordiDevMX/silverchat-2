import { type PropsWithChildren, useEffect, useRef } from "react";

const modalStack: HTMLDialogElement[] = [];

export function Modal({
  title,
  children,
  onClose,
  className = "",
}: PropsWithChildren<{ title: string; onClose?: () => void; className?: string }>) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    if (dialog) modalStack.push(dialog);
    // Disabling the focused action can move focus to body. Keep repeated Escape
    // controlled even then, and let only the top native dialog handle it.
    const escapeFromBody = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        modalStack.at(-1) !== dialog ||
        (event.target !== document.body && event.target !== document.documentElement)
      )
        return;
      event.preventDefault();
      closeRef.current?.();
    };
    document.addEventListener("keydown", escapeFromBody);
    return () => {
      document.removeEventListener("keydown", escapeFromBody);
      const index = dialog ? modalStack.indexOf(dialog) : -1;
      if (index >= 0) modalStack.splice(index, 1);
      dialog?.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  return (
    <dialog
      data-slot="modal"
      ref={ref}
      tabIndex={-1}
      aria-label={title}
      onKeyDown={(event) => {
        // Handle Escape before the browser's native close action, including repeated
        // presses while busy. The owning dialog controls dismissal and exit presence.
        if (
          event.key === "Escape" &&
          !event.defaultPrevented &&
          (event.target as Element).closest("dialog") === event.currentTarget
        ) {
          event.preventDefault();
          event.stopPropagation();
          onClose?.();
          return;
        }
        // Nested dialogs own their focus loop; hidden/disabled controls are skipped.
        if (
          event.key !== "Tab" ||
          (event.target as Element).closest("dialog") !== event.currentTarget
        )
          return;
        const dialog = event.currentTarget;
        const controls = [
          ...dialog.querySelectorAll<HTMLElement>(
            'button, a[href], input, select, textarea, [tabindex], [contenteditable="true"], audio[controls], video[controls]',
          ),
        ].filter(
          (el) =>
            el.tabIndex >= 0 &&
            !el.matches(":disabled") &&
            !el.closest("[hidden], [inert]") &&
            el.closest("dialog") === dialog &&
            el.getClientRects().length > 0 &&
            getComputedStyle(el).visibility !== "hidden",
        );
        const first = controls[0];
        const last = controls.at(-1);
        const active = document.activeElement;
        if (
          !first ||
          !controls.includes(active as HTMLElement) ||
          (event.shiftKey ? active === first : active === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? (last ?? dialog) : (first ?? dialog)).focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose?.();
      }}
      className={`auth-modal ${className}`}
    >
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
