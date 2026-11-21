import { useRouter } from "@tanstack/react-router";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { reactionNotificationStore } from "@/features/chats/utils/reactionNotifications";
import { detectDeviceLanguage, readChosenLanguage } from "@/lib/language";
import { type ToastRecord, type ToastTone, useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function hasNativePopover() {
  return (
    typeof HTMLElement !== "undefined" &&
    Object.hasOwn(HTMLElement.prototype, "popover") &&
    typeof HTMLElement.prototype.showPopover === "function"
  );
}

interface ViewportArea {
  left: number;
  width: number;
  bottom: number;
}

/**
 * Measures the active SilverChat content viewport (.chat-content-pane when inside
 * a conversation/split workspace, falling back to .authenticated-content or the
 * browser viewport) so toasts center horizontally inside the chat/main area and
 * clear both the mobile tab bar and message composer.
 */
function measureToastViewportArea(): ViewportArea {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { left: 0, width: 0, bottom: 24 };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const contentPane = document.querySelector<HTMLElement>(".chat-content-pane");
  const authContent = document.querySelector<HTMLElement>(".authenticated-content");

  const contentRect = contentPane?.getBoundingClientRect();
  const authRect = authContent?.getBoundingClientRect();
  const target =
    contentPane && contentRect && contentRect.width > 0
      ? { el: contentPane, rect: contentRect }
      : authContent && authRect && authRect.width > 0
        ? { el: authContent, rect: authRect }
        : null;

  if (!target) {
    return { left: 0, width: vw, bottom: 24 };
  }

  const { el, rect } = target;
  const left = Math.max(0, Math.round(rect.left));
  const width = Math.max(0, Math.round(rect.width));

  const nav = document.querySelector<HTMLElement>(".app-navigation");
  const navRect = nav?.getBoundingClientRect();
  const bottomBarInset =
    navRect && navRect.top > vh / 2 && navRect.height > 0 ? Math.max(0, vh - navRect.top) : 0;

  let bottom = Math.max(20, Math.round(vh - rect.bottom + 20), Math.round(bottomBarInset + 16));

  const composer = el.querySelector<HTMLElement>(
    '[data-slot="composer-dock"], .restricted-composer-notice',
  );
  if (composer) {
    const composerRect = composer.getBoundingClientRect();
    if (composerRect.height > 0 && composerRect.top < vh) {
      bottom = Math.max(bottom, Math.round(vh - composerRect.top + 14));
    }
  }

  return { left, width, bottom };
}

function ToastStatusIcon({ tone }: { tone: ToastTone }) {
  switch (tone) {
    case "success":
      return <CheckCircle2 size={15} strokeWidth={2.2} aria-hidden="true" />;
    case "warning":
      return <AlertTriangle size={15} strokeWidth={2.2} aria-hidden="true" />;
    case "error":
      return <AlertCircle size={15} strokeWidth={2.2} aria-hidden="true" />;
    default:
      return <Info size={15} strokeWidth={2.2} aria-hidden="true" />;
  }
}

function ToastCard({
  toast,
  dismissLabel,
  onDismiss,
  onPause,
  onResume,
}: {
  toast: ToastRecord;
  dismissLabel: string;
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) {
  const router = useRouter();
  const action = toast.action;
  const isAlert = toast.tone === "error";

  const handleAction = () => {
    if (!action) return;
    onDismiss(toast.id);
    if (action.onClick) {
      action.onClick();
      return;
    }
    if (action.kind === "reaction" && action.chatId && action.messageId) {
      reactionNotificationStore.getState().setActiveToast(null, null);
      reactionNotificationStore.getState().requestNavigation(action.chatId, action.messageId);
    }
    if (action.href) {
      void router.navigate({ href: action.href });
    }
  };

  return (
    <div
      data-slot="toast"
      data-toast-id={toast.id}
      data-tone={toast.tone}
      data-state={toast.state}
      className={cn("silver-toast", "chat-settings-notice", toast.className)}
      role={isAlert ? "alert" : "status"}
      aria-live={isAlert ? "assertive" : "polite"}
      aria-atomic="true"
      onFocusCapture={() => onPause(toast.id)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onResume(toast.id);
        }
      }}
    >
      <span className="silver-toast-icon" aria-hidden="true">
        <ToastStatusIcon tone={toast.tone} />
      </span>

      <div className="silver-toast-content">
        {action ? (
          <button
            type="button"
            className="silver-toast-link chat-notice-link"
            onClick={handleAction}
          >
            {toast.message}
          </button>
        ) : (
          <span>{toast.message}</span>
        )}
      </div>

      {toast.dismissible && (
        <button
          type="button"
          className="silver-toast-dismiss"
          aria-label={dismissLabel}
          onClick={() => onDismiss(toast.id)}
        >
          <X size={14} strokeWidth={2.2} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * Global top-layer toast viewport centered horizontally inside the active
 * chat/main viewport, with stacking, 2-second auto-dismiss, and accessible announcements.
 */
export function ToastViewport() {
  const { toasts, dismiss, pause, resume, clear } = useToast();
  const viewportRef = useRef<HTMLDivElement>(null);

  const language = readChosenLanguage() ?? detectDeviceLanguage();
  const regionLabel = language === "es" ? "Notificaciones" : "Notifications";
  const dismissLabel = language === "es" ? "Cerrar" : "Dismiss";
  const hasToasts = toasts.length > 0;

  const syncPosition = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const area = measureToastViewportArea();
    el.style.setProperty("--toast-area-left", `${area.left}px`);
    el.style.setProperty("--toast-area-width", `${area.width}px`);
    el.style.setProperty("--toast-area-bottom", `${area.bottom}px`);
  }, []);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    if (hasToasts) {
      syncPosition();
      if (hasNativePopover()) {
        try {
          if (!el.matches(":popover-open")) el.showPopover();
        } catch {
          el.setAttribute("data-fallback-open", "true");
        }
      } else {
        el.setAttribute("data-fallback-open", "true");
      }
    } else {
      if (hasNativePopover()) {
        try {
          if (el.matches(":popover-open")) el.hidePopover();
        } catch {
          el.removeAttribute("data-fallback-open");
        }
      }
      el.removeAttribute("data-fallback-open");
    }
  }, [hasToasts, syncPosition]);

  useEffect(() => {
    if (!hasToasts) return;

    syncPosition();
    const onResize = () => syncPosition();
    window.addEventListener("resize", onResize);

    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => syncPosition()) : null;
    if (observer) {
      observer.observe(document.body);
      const pane = document.querySelector<HTMLElement>(".chat-content-pane");
      if (pane) observer.observe(pane);
      const authContent = document.querySelector<HTMLElement>(".authenticated-content");
      if (authContent) observer.observe(authContent);
      const composer = document.querySelector<HTMLElement>(
        '[data-slot="composer-dock"], .restricted-composer-notice',
      );
      if (composer) observer.observe(composer);
    }

    const mutationObserver =
      typeof MutationObserver !== "undefined" ? new MutationObserver(() => syncPosition()) : null;
    const shellRoot = document.querySelector<HTMLElement>(".app-shell") ?? document.body;
    mutationObserver?.observe(shellRoot, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [hasToasts, syncPosition]);

  useEffect(() => () => clear(), [clear]);

  return (
    <section
      ref={viewportRef}
      aria-label={regionLabel}
      popover="manual"
      data-slot="toast-viewport"
      className="silver-toast-viewport"
    >
      {toasts.map((item) => (
        <ToastCard
          key={item.id}
          toast={item}
          dismissLabel={dismissLabel}
          onDismiss={dismiss}
          onPause={pause}
          onResume={resume}
        />
      ))}
    </section>
  );
}
