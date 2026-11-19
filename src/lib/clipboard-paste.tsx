import { AlertCircle, Info, X } from "lucide-react";
import {
  createContext,
  type PropsWithChildren,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/app/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { clearMemoryDraftMedia } from "@/features/chats/draftMedia";
import { registerBeforeSignOut } from "@/lib/auth";
import {
  type ClipboardReasonHint,
  type DataTransferExtractionResult,
  extractDataTransferMedia,
  formatClipboardFeedback,
  formatTextOnlyPasteNotice,
  isEditableInputDisabled,
  isTextInputElement,
  MAX_CLIPBOARD_IMAGE_BYTES,
  MAX_CLIPBOARD_IMAGES_DEFAULT,
} from "./clipboard-images";

export interface ClipboardImageTargetConfig {
  element: HTMLElement;
  kind: "images" | "single-image";
  disabled?: boolean;
  maxCount?: number;
  existingCount?: number;
  maxFileBytes?: number;
  onImages: (files: File[], meta: DataTransferExtractionResult) => void;
  onFeedback?: (message: string, severity: "info" | "error") => void;
}

interface ClipboardNoticeState {
  id: number;
  message: string;
  severity: "info" | "error";
  dialog: HTMLDialogElement | null;
}

interface ClipboardPasteContextValue {
  registerTarget: (id: string, config: ClipboardImageTargetConfig) => () => void;
  showNotice: (
    message: string,
    severity?: "info" | "error",
    anchorElement?: HTMLElement | null,
  ) => void;
  clearNotice: () => void;
}

const ClipboardPasteContext = createContext<ClipboardPasteContextValue | null>(null);
const claimedPasteEvents = new WeakSet<ClipboardEvent>();

const REASON_HINTS = new Set<string>([
  "text-only",
  "edit-message",
  "story-text",
  "story-reply",
  "search",
  "auth-code",
  "avatar-hint",
]);

function resolveReasonHint(el: HTMLElement): ClipboardReasonHint {
  const raw = el.closest("[data-clipboard-reason]")?.getAttribute("data-clipboard-reason");
  if (raw && REASON_HINTS.has(raw)) return raw as ClipboardReasonHint;
  if (el instanceof HTMLInputElement && el.type === "search") return "search";
  return "text-only";
}

function findMatchingTarget(
  eventTarget: EventTarget | null,
  targets: Map<string, ClipboardImageTargetConfig>,
): ClipboardImageTargetConfig | null {
  if (!(eventTarget instanceof Node)) return null;
  let best: ClipboardImageTargetConfig | null = null;
  for (const config of targets.values()) {
    const el = config.element;
    if (!el.isConnected) continue;
    if (el === eventTarget || el.contains(eventTarget)) {
      // Prefer the deepest/most specific registered element in the DOM tree.
      if (!best || best.element.contains(el)) {
        best = config;
      }
    }
  }
  return best;
}

export function ClipboardPasteProvider({ children }: PropsWithChildren) {
  const { language } = useI18n();
  const targetsRef = useRef(new Map<string, ClipboardImageTargetConfig>());
  const [notice, setNotice] = useState<ClipboardNoticeState | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pausedRef = useRef(false);
  const sequenceRef = useRef(0);

  const clearNotice = useCallback(() => {
    clearTimeout(timerRef.current);
    setNotice(null);
  }, []);

  const scheduleDismiss = useCallback((id: number) => {
    clearTimeout(timerRef.current);
    if (pausedRef.current) return;
    timerRef.current = setTimeout(() => {
      setNotice((current) => (current?.id === id ? null : current));
    }, 5000);
  }, []);

  const showNotice = useCallback(
    (message: string, severity: "info" | "error" = "info", anchorElement?: HTMLElement | null) => {
      if (!message) return;
      const id = ++sequenceRef.current;
      const activeDialog =
        anchorElement?.closest("dialog[open]") instanceof HTMLDialogElement
          ? (anchorElement.closest("dialog[open]") as HTMLDialogElement)
          : document.activeElement instanceof HTMLElement &&
              document.activeElement.closest("dialog[open]") instanceof HTMLDialogElement
            ? (document.activeElement.closest("dialog[open]") as HTMLDialogElement)
            : null;
      setNotice({ id, message, severity, dialog: activeDialog });
      scheduleDismiss(id);
    },
    [scheduleDismiss],
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);
  useEffect(() => registerBeforeSignOut(async () => clearMemoryDraftMedia()), []);

  useEffect(() => {
    const el = noticeRef.current;
    if (!el || !notice) return;
    const pause = () => {
      pausedRef.current = true;
      clearTimeout(timerRef.current);
    };
    const resume = () => {
      pausedRef.current = false;
      scheduleDismiss(notice.id);
    };
    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", resume);
    el.addEventListener("focusin", pause);
    el.addEventListener("focusout", resume);
    return () => {
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", resume);
      el.removeEventListener("focusin", pause);
      el.removeEventListener("focusout", resume);
    };
  }, [notice, scheduleDismiss]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      // Claim ownership synchronously before any target dispatch or DOM work.
      if (claimedPasteEvents.has(event)) return;
      claimedPasteEvents.add(event);

      const targetNode = event.target;
      const textInput = isTextInputElement(targetNode);
      const matched = findMatchingTarget(targetNode, targetsRef.current);

      // Keep nested search/text-only inputs (e.g., emoji search inside a composer) isolated.
      const isolatedTextInput =
        textInput &&
        matched &&
        textInput !== matched.element &&
        (textInput.getAttribute("data-clipboard-images") === "text-only" ||
          textInput.hasAttribute("data-clipboard-reason") ||
          (textInput instanceof HTMLInputElement && textInput.type === "search"));

      const activeTarget = isolatedTextInput ? null : matched;

      if (activeTarget) {
        const maxCount =
          activeTarget.kind === "single-image"
            ? 1
            : (activeTarget.maxCount ?? MAX_CLIPBOARD_IMAGES_DEFAULT);
        const existingCount =
          activeTarget.kind === "single-image" ? 0 : (activeTarget.existingCount ?? 0);
        const maxFileBytes = activeTarget.maxFileBytes ?? MAX_CLIPBOARD_IMAGE_BYTES;

        const extraction = extractDataTransferMedia(event.clipboardData, {
          maxCount,
          existingCount,
          maxFileBytes,
          strictImagesOnly: true,
        });

        if (!extraction.hadMediaPayload) return;

        if (activeTarget.disabled || (textInput && isEditableInputDisabled(textInput))) {
          if (!extraction.plainText) event.preventDefault();
          return;
        }

        if (!extraction.plainText) {
          event.preventDefault();
        }

        if (extraction.images.length > 0) {
          activeTarget.onImages(extraction.images, extraction);
        }

        const feedback = formatClipboardFeedback(extraction, language, {
          maxCount,
          maxFileBytes,
          singleImageMode: activeTarget.kind === "single-image",
        });
        if (feedback) {
          const severity =
            extraction.images.length === 0 &&
            (extraction.rejected.length > 0 || extraction.clipboardBlocked)
              ? "error"
              : "info";
          if (activeTarget.onFeedback) activeTarget.onFeedback(feedback, severity);
          else showNotice(feedback, severity, activeTarget.element);
        }
        return;
      }

      if (!textInput) return;

      const extraction = extractDataTransferMedia(event.clipboardData, {
        maxCount: 1,
        existingCount: 0,
        strictImagesOnly: false,
      });

      const hasAnyImagePayload =
        extraction.images.length > 0 ||
        extraction.clipboardBlocked ||
        extraction.rejected.some(
          (r) =>
            r.reason === "unsupported-format" ||
            r.reason === "too-large" ||
            r.reason === "empty-file",
        );

      if (!hasAnyImagePayload) return;

      if (!extraction.plainText) {
        event.preventDefault();
      }

      const reason = resolveReasonHint(textInput);
      const noticeText = formatTextOnlyPasteNotice(
        reason,
        extraction.plainText.length > 0,
        language,
      );
      showNotice(noticeText, "info", textInput);
    };

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [language, showNotice]);

  const registerTarget = useCallback((id: string, config: ClipboardImageTargetConfig) => {
    targetsRef.current.set(id, config);
    return () => {
      const current = targetsRef.current.get(id);
      if (current === config) targetsRef.current.delete(id);
    };
  }, []);

  const contextValue = useMemo(
    () => ({ registerTarget, showNotice, clearNotice }),
    [registerTarget, showNotice, clearNotice],
  );

  const dismissLabel = language === "es" ? "Cerrar" : "Dismiss";

  const banner = notice ? (
    <div
      ref={noticeRef}
      key={notice.id}
      data-slot="clipboard-paste-notice"
      data-severity={notice.severity}
      className={`chat-settings-notice chat-settings-notice-v2 clipboard-paste-notice${
        notice.dialog ? " in-dialog" : ""
      }`}
      role={notice.severity === "error" ? "alert" : "status"}
      aria-live={notice.severity === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <span className="clipboard-paste-notice-body">
        {notice.severity === "error" ? (
          <AlertCircle size={16} aria-hidden="true" className="shrink-0 text-destructive" />
        ) : (
          <Info size={16} aria-hidden="true" className="shrink-0 text-primary" />
        )}
        <span>{notice.message}</span>
      </span>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label={dismissLabel}
        onClick={clearNotice}
      >
        <X size={16} aria-hidden="true" />
      </Button>
    </div>
  ) : null;

  return (
    <ClipboardPasteContext.Provider value={contextValue}>
      {children}
      {banner &&
        (notice?.dialog?.isConnected && notice.dialog.open
          ? createPortal(banner, notice.dialog)
          : banner)}
    </ClipboardPasteContext.Provider>
  );
}

export function useClipboardPaste() {
  return useContext(ClipboardPasteContext);
}

export function useClipboardImageTarget({
  ref,
  kind,
  disabled = false,
  maxCount,
  existingCount = 0,
  maxFileBytes,
  onImages,
  onFeedback,
}: {
  ref: RefObject<HTMLElement | null>;
  kind: "images" | "single-image";
  disabled?: boolean;
  maxCount?: number;
  existingCount?: number;
  maxFileBytes?: number;
  onImages: (files: File[], meta: DataTransferExtractionResult) => void;
  onFeedback?: (message: string, severity: "info" | "error") => void;
}) {
  const ctx = useClipboardPaste();
  const id = useId();
  const onImagesRef = useRef(onImages);
  onImagesRef.current = onImages;
  const onFeedbackRef = useRef(onFeedback);
  onFeedbackRef.current = onFeedback;

  useEffect(() => {
    const element = ref.current;
    if (!ctx || !element) return;
    return ctx.registerTarget(id, {
      element,
      kind,
      disabled,
      maxCount,
      existingCount,
      maxFileBytes,
      onImages: (files, meta) => onImagesRef.current(files, meta),
      onFeedback: onFeedbackRef.current
        ? (msg, sev) => onFeedbackRef.current?.(msg, sev)
        : undefined,
    });
  }, [ctx, id, ref, kind, disabled, maxCount, existingCount, maxFileBytes]);
}
