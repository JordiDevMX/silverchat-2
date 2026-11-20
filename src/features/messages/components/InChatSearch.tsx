import { ChevronDown, ChevronUp, Info, Search, X } from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { useInChatSearch } from "../hooks/useInChatSearch";
import { useMessageText } from "../i18n";

const AUTO_DISMISS_MS = 2200;

type AriaNotifyDocument = Document & {
  ariaNotify?: (message: string) => void;
};

function hasNativePopover() {
  return typeof HTMLElement !== "undefined" && Object.hasOwn(HTMLElement.prototype, "popover");
}

let supportsDisplayTransition: boolean | undefined;

function canTransitionDisplay() {
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (
    typeof window === "undefined" ||
    !window.CSS?.supports?.("transition-behavior", "allow-discrete") ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement("div");
  probe.style.cssText = "transition: display 1s allow-discrete !important; display: block;";
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = "none";
  supportsDisplayTransition = getComputedStyle(probe).display === "block";
  probe.remove();
  return supportsDisplayTransition;
}

function supportsTopLayerExit() {
  return (
    typeof window !== "undefined" &&
    !!window.CSS?.supports?.("overlay", "auto") &&
    canTransitionDisplay()
  );
}

function isToastElementOpen(el: HTMLDivElement) {
  if (hasNativePopover()) return el.matches(":popover-open");
  return el.getAttribute("data-fallback-open") === "true";
}

export function InChatSearch({
  search,
  onClose,
}: {
  search: ReturnType<typeof useInChatSearch>;
  onClose: () => void;
}) {
  const { say } = useMessageText();
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const anchorName = `--in-chat-search-${instanceId}`;
  const hintId = `in-chat-search-hint-${instanceId}`;
  const toastId = `in-chat-search-toast-${instanceId}`;

  const headerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);
  const modeRef = useRef<"auto" | "manual">("auto");
  const announceFrameRef = useRef<number | null>(null);

  const [toastOpen, setToastOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const scopeMessage = say(
    "Search covers loaded messages only. Scroll up to load more.",
    "La búsqueda incluye solo mensajes cargados. Desplázate arriba para cargar más.",
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const syncFallbackPosition = useCallback(() => {
    const header = headerRef.current;
    const toast = toastRef.current;
    if (!header || !toast) return;
    if (window.CSS?.supports?.("top", "anchor(bottom)")) return;
    const rect = header.getBoundingClientRect();
    toast.style.setProperty("--search-toast-top", `${Math.round(rect.bottom + 8)}px`);
    toast.style.setProperty("--search-toast-left", `${Math.round(rect.left + rect.width / 2)}px`);
    toast.style.setProperty(
      "--search-toast-max-width",
      `${Math.max(200, Math.min(Math.round(rect.width) - 24, 420))}px`,
    );
  }, []);

  const dismissToast = useCallback(
    async ({ returnFocus = false }: { returnFocus?: boolean } = {}) => {
      clearTimer();
      const toast = toastRef.current;
      if (!toast) return;
      const hadFocus = toast.contains(document.activeElement);
      setToastOpen(false);
      if (hasNativePopover()) {
        if (toast.matches(":popover-open")) {
          if (!supportsTopLayerExit()) {
            toast.setAttribute("data-closing", "");
            const animations = toast.getAnimations({ subtree: true });
            if (animations.length > 0) {
              await Promise.race([
                Promise.allSettled(animations.map((animation) => animation.finished)),
                new Promise((resolve) => window.setTimeout(resolve, 500)),
              ]);
            }
            if (!toast.hasAttribute("data-closing")) return;
            toast.removeAttribute("data-closing");
          }
          if (toast.matches(":popover-open")) toast.hidePopover();
        }
      } else {
        toast.removeAttribute("data-fallback-open");
      }
      if (returnFocus || hadFocus) {
        inputRef.current?.focus();
      }
    },
    [clearTimer],
  );

  const scheduleAutoDismiss = useCallback(() => {
    clearTimer();
    if (modeRef.current !== "auto" || hoveredRef.current || focusedRef.current) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (hoveredRef.current || focusedRef.current) return;
      void dismissToast();
    }, AUTO_DISMISS_MS);
  }, [clearTimer, dismissToast]);

  const openToast = useCallback(
    (mode: "auto" | "manual") => {
      const toast = toastRef.current;
      if (!toast) return;
      clearTimer();
      modeRef.current = mode;
      toast.removeAttribute("data-closing");
      syncFallbackPosition();
      if (hasNativePopover()) {
        if (!toast.matches(":popover-open")) toast.showPopover();
      } else {
        toast.setAttribute("data-fallback-open", "true");
      }
      setToastOpen(true);
      if (mode === "auto") {
        scheduleAutoDismiss();
      } else {
        const doc = document as AriaNotifyDocument;
        if (typeof doc.ariaNotify === "function") {
          doc.ariaNotify(scopeMessage);
        } else {
          setAnnouncement("");
          if (announceFrameRef.current !== null) {
            window.cancelAnimationFrame(announceFrameRef.current);
          }
          announceFrameRef.current = window.requestAnimationFrame(() => {
            announceFrameRef.current = null;
            setAnnouncement(scopeMessage);
          });
        }
      }
    },
    [clearTimer, scheduleAutoDismiss, scopeMessage, syncFallbackPosition],
  );

  useEffect(() => {
    inputRef.current?.focus();
    openToast("auto");
    return () => {
      clearTimer();
      if (announceFrameRef.current !== null) {
        window.cancelAnimationFrame(announceFrameRef.current);
      }
      const toast = toastRef.current;
      if (toast && isToastElementOpen(toast)) {
        if (hasNativePopover()) toast.hidePopover();
        else toast.removeAttribute("data-fallback-open");
      }
    };
  }, [clearTimer, openToast]);

  useEffect(() => {
    const toast = toastRef.current;
    if (!toast) return;
    const onToggle = (event: Event) => {
      const toggleEvent = event as ToggleEvent;
      if (toggleEvent.newState === "closed") {
        clearTimer();
        setToastOpen(false);
      }
    };
    const onMouseEnter = () => {
      hoveredRef.current = true;
      clearTimer();
    };
    const onMouseLeave = () => {
      hoveredRef.current = false;
      scheduleAutoDismiss();
    };
    const onFocusIn = () => {
      focusedRef.current = true;
      clearTimer();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (toast.contains(event.relatedTarget as Node | null)) return;
      focusedRef.current = false;
      scheduleAutoDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        void dismissToast({ returnFocus: true });
      }
    };
    if (hasNativePopover()) toast.addEventListener("toggle", onToggle);
    toast.addEventListener("mouseenter", onMouseEnter);
    toast.addEventListener("mouseleave", onMouseLeave);
    toast.addEventListener("focusin", onFocusIn);
    toast.addEventListener("focusout", onFocusOut);
    toast.addEventListener("keydown", onKeyDown);
    return () => {
      if (hasNativePopover()) toast.removeEventListener("toggle", onToggle);
      toast.removeEventListener("mouseenter", onMouseEnter);
      toast.removeEventListener("mouseleave", onMouseLeave);
      toast.removeEventListener("focusin", onFocusIn);
      toast.removeEventListener("focusout", onFocusOut);
      toast.removeEventListener("keydown", onKeyDown);
    };
  }, [clearTimer, dismissToast, scheduleAutoDismiss]);

  useEffect(() => {
    if (!toastOpen) return;
    if (window.CSS?.supports?.("top", "anchor(bottom)")) return;
    syncFallbackPosition();
    const header = headerRef.current;
    const observer = header ? new ResizeObserver(() => syncFallbackPosition()) : null;
    if (header && observer) observer.observe(header);
    window.addEventListener("resize", syncFallbackPosition);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncFallbackPosition);
    };
  }, [syncFallbackPosition, toastOpen]);

  const statusText = search.results.length
    ? `${search.index + 1}/${search.results.length}`
    : search.query
      ? say("No results", "Sin resultados")
      : "";

  return (
    <header
      ref={headerRef}
      data-slot="in-chat-search"
      className="in-chat-search bg-gradient-silver backdrop-blur-xl shadow-silver"
      style={{ anchorName } as CSSProperties}
    >
      <div className="in-chat-search-row">
        <div className="in-chat-search-field">
          <Search size={17} aria-hidden="true" className="in-chat-search-leading" />
          <Input
            type="search"
            ref={inputRef}
            aria-label={say("Search in conversation", "Buscar en conversación")}
            aria-describedby={hintId}
            placeholder={say("Search messages…", "Buscar mensajes…")}
            value={search.text}
            onChange={(e) => search.setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                search.move(e.shiftKey ? -1 : 1);
              }
            }}
            className="in-chat-search-input h-10 w-0 min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 text-foreground shadow-none outline-none focus-visible:ring-0 [&::-webkit-search-cancel-button]:hidden"
          />
          <span role="status" className="in-chat-search-status">
            {statusText}
          </span>
        </div>
        <div className="in-chat-search-actions">
          <button
            type="button"
            className="message-icon"
            aria-label={say("Previous result", "Resultado anterior")}
            disabled={!search.results.length}
            onClick={() => search.move(-1)}
          >
            <ChevronUp size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="message-icon"
            aria-label={say("Next result", "Resultado siguiente")}
            disabled={!search.results.length}
            onClick={() => search.move(1)}
          >
            <ChevronDown size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="message-icon in-chat-search-info"
            aria-label={say("Search scope info", "Información del alcance de búsqueda")}
            aria-expanded={toastOpen}
            aria-controls={toastId}
            onClick={() => {
              if (toastOpen) void dismissToast();
              else openToast("manual");
            }}
          >
            <Info size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="message-icon"
            aria-label={say("Close search", "Cerrar búsqueda")}
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <span id={hintId} className="sr-only">
        {scopeMessage}
      </span>

      <section
        aria-label={say("Search notifications", "Notificaciones de búsqueda")}
        className="in-chat-search-toast-region"
      >
        <div
          ref={toastRef}
          id={toastId}
          popover="manual"
          className="in-chat-search-toast"
          style={{ positionAnchor: anchorName } as CSSProperties}
        >
          <Info size={16} aria-hidden="true" className="in-chat-search-toast-icon" />
          <span className="in-chat-search-toast-text">{scopeMessage}</span>
          <button
            type="button"
            className="in-chat-search-toast-close"
            popoverTarget={toastId}
            popoverTargetAction="hide"
            aria-label={say("Dismiss search info", "Cerrar aviso de búsqueda")}
            onClick={(e) => {
              e.preventDefault();
              void dismissToast({ returnFocus: true });
            }}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      </section>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </header>
  );
}
