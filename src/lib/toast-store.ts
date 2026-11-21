import { createStore } from "zustand/vanilla";

export const TOAST_DURATION_MS = 2000;
export const TOAST_EXIT_MS = 180;
export const MAX_VISIBLE_TOASTS = 3;

export type ToastTone = "info" | "success" | "warning" | "error";

export interface ToastAction {
  label?: string;
  kind?: string;
  href?: string;
  chatId?: string;
  messageId?: string;
  onClick?: () => void;
}

export interface ToastInput {
  id?: string;
  message: string;
  tone?: ToastTone;
  durationMs?: number;
  dismissible?: boolean;
  action?: ToastAction | null;
  className?: string;
  onDismiss?: () => void;
}

export interface ToastRecord {
  id: string;
  message: string;
  tone: ToastTone;
  durationMs: number;
  dismissible: boolean;
  action: ToastAction | null;
  className?: string;
  state: "open" | "closing";
  createdAt: number;
  triggerCount: number;
  onDismiss?: () => void;
}

export interface ToastStoreState {
  toasts: ToastRecord[];
  queue: ToastRecord[];
  show: (input: ToastInput) => string;
  info: (message: string, options?: Omit<ToastInput, "message" | "tone">) => string;
  success: (message: string, options?: Omit<ToastInput, "message" | "tone">) => string;
  warning: (message: string, options?: Omit<ToastInput, "message" | "tone">) => string;
  error: (message: string, options?: Omit<ToastInput, "message" | "tone">) => string;
  dismiss: (id: string, options?: { immediate?: boolean }) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
  clear: () => void;
}

export interface CreateToastStoreOptions {
  defaultDurationMs?: number;
  exitDurationMs?: number;
  maxVisible?: number;
  prefersReducedMotion?: () => boolean;
}

function defaultPrefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Creates a self-contained toast store with deterministic auto-dismiss timers,
 * queueing/stacking, timer deduplication on re-trigger, and clean teardown.
 */
export function createToastStore(options: CreateToastStoreOptions = {}) {
  const defaultDurationMs = options.defaultDurationMs ?? TOAST_DURATION_MS;
  const exitDurationMs = options.exitDurationMs ?? TOAST_EXIT_MS;
  const maxVisible = Math.max(1, options.maxVisible ?? MAX_VISIBLE_TOASTS);
  const prefersReducedMotion = options.prefersReducedMotion ?? defaultPrefersReducedMotion;

  let nextId = 0;
  const autoTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const exitTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const timerMeta = new Map<string, { expiresAt: number; remainingMs: number }>();

  const clearAutoTimer = (id: string) => {
    const timer = autoTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      autoTimers.delete(id);
    }
    timerMeta.delete(id);
  };

  const clearExitTimer = (id: string) => {
    const timer = exitTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      exitTimers.delete(id);
    }
  };

  const clearAllTimers = () => {
    for (const timer of autoTimers.values()) clearTimeout(timer);
    for (const timer of exitTimers.values()) clearTimeout(timer);
    autoTimers.clear();
    exitTimers.clear();
    timerMeta.clear();
  };

  return createStore<ToastStoreState>((set, get) => {
    const scheduleAutoDismiss = (id: string, delayMs: number) => {
      clearAutoTimer(id);
      if (!Number.isFinite(delayMs) || delayMs <= 0) return;
      const expiresAt = Date.now() + delayMs;
      timerMeta.set(id, { expiresAt, remainingMs: delayMs });
      const timer = setTimeout(() => {
        autoTimers.delete(id);
        timerMeta.delete(id);
        get().dismiss(id);
      }, delayMs);
      autoTimers.set(id, timer);
    };

    const finalizeRemoval = (id: string) => {
      clearAutoTimer(id);
      clearExitTimer(id);
      let removed: ToastRecord | undefined;
      let promoted: ToastRecord | undefined;

      set((state) => {
        const nextToasts = state.toasts.filter((item) => {
          if (item.id === id) {
            removed = item;
            return false;
          }
          return true;
        });
        if (!removed) return state;

        let nextQueue = state.queue;
        if (nextToasts.length < maxVisible && state.queue.length > 0) {
          [promoted, ...nextQueue] = state.queue;
          if (promoted) {
            nextToasts.push({ ...promoted, state: "open" });
          }
        }
        return { toasts: nextToasts, queue: nextQueue };
      });

      if (removed) {
        removed.onDismiss?.();
      }
      if (promoted) {
        scheduleAutoDismiss(promoted.id, promoted.durationMs);
      }
    };

    const dismiss = (id: string, dismissOptions?: { immediate?: boolean }) => {
      clearAutoTimer(id);
      const state = get();
      const queuedItem = state.queue.find((item) => item.id === id);
      if (queuedItem) {
        set((prev) => ({ queue: prev.queue.filter((item) => item.id !== id) }));
        queuedItem.onDismiss?.();
        return;
      }

      const activeItem = state.toasts.find((item) => item.id === id);
      if (!activeItem) return;

      const immediate =
        dismissOptions?.immediate === true || exitDurationMs <= 0 || prefersReducedMotion();

      if (immediate) {
        finalizeRemoval(id);
        return;
      }

      if (activeItem.state === "closing") return;

      clearExitTimer(id);
      set((prev) => ({
        toasts: prev.toasts.map((item) => (item.id === id ? { ...item, state: "closing" } : item)),
      }));

      const exitTimer = setTimeout(() => {
        exitTimers.delete(id);
        finalizeRemoval(id);
      }, exitDurationMs);
      exitTimers.set(id, exitTimer);
    };

    const show = (input: ToastInput) => {
      const message = input.message.trim();
      if (!message) return "";

      const id = input.id ?? `toast-${++nextId}`;
      const durationMs = input.durationMs ?? defaultDurationMs;
      const now = Date.now();

      clearAutoTimer(id);
      clearExitTimer(id);

      const current = get();
      const existingActive = current.toasts.find((item) => item.id === id);
      if (existingActive) {
        const updated: ToastRecord = {
          ...existingActive,
          message,
          tone: input.tone ?? existingActive.tone,
          durationMs,
          dismissible: input.dismissible ?? existingActive.dismissible,
          action: input.action === undefined ? existingActive.action : input.action,
          className: input.className ?? existingActive.className,
          state: "open",
          triggerCount: existingActive.triggerCount + 1,
          onDismiss: input.onDismiss ?? existingActive.onDismiss,
        };
        set((prev) => ({
          toasts: prev.toasts.map((item) => (item.id === id ? updated : item)),
        }));
        scheduleAutoDismiss(id, durationMs);
        return id;
      }

      const record: ToastRecord = {
        id,
        message,
        tone: input.tone ?? "info",
        durationMs,
        dismissible: input.dismissible ?? true,
        action: input.action ?? null,
        className: input.className,
        state: "open",
        createdAt: now,
        triggerCount: 1,
        onDismiss: input.onDismiss,
      };

      const existingQueued = current.queue.find((item) => item.id === id);
      if (existingQueued) {
        set((prev) => ({
          queue: prev.queue.map((item) =>
            item.id === id ? { ...record, triggerCount: item.triggerCount + 1 } : item,
          ),
        }));
        return id;
      }

      if (current.toasts.length < maxVisible) {
        set((prev) => ({ toasts: [...prev.toasts, record] }));
        scheduleAutoDismiss(id, durationMs);
      } else {
        set((prev) => ({ queue: [...prev.queue, record] }));
      }
      return id;
    };

    const pause = (id: string) => {
      const meta = timerMeta.get(id);
      const timer = autoTimers.get(id);
      if (!meta || timer === undefined) return;
      clearTimeout(timer);
      autoTimers.delete(id);
      const remainingMs = Math.max(0, meta.expiresAt - Date.now());
      timerMeta.set(id, { expiresAt: meta.expiresAt, remainingMs });
    };

    const resume = (id: string) => {
      const item = get().toasts.find((entry) => entry.id === id);
      if (item?.state !== "open" || autoTimers.has(id)) return;
      const meta = timerMeta.get(id);
      const remainingMs = meta ? meta.remainingMs : item.durationMs;
      if (remainingMs <= 0) {
        dismiss(id);
        return;
      }
      scheduleAutoDismiss(id, remainingMs);
    };

    const clear = () => {
      clearAllTimers();
      set({ toasts: [], queue: [] });
    };

    return {
      toasts: [],
      queue: [],
      show,
      info: (message, opts) => show({ ...opts, message, tone: "info" }),
      success: (message, opts) => show({ ...opts, message, tone: "success" }),
      warning: (message, opts) => show({ ...opts, message, tone: "warning" }),
      error: (message, opts) => show({ ...opts, message, tone: "error" }),
      dismiss,
      pause,
      resume,
      clear,
    };
  });
}

export const toastStore = createToastStore();

export const toast = {
  show: (input: ToastInput) => toastStore.getState().show(input),
  info: (message: string, options?: Omit<ToastInput, "message" | "tone">) =>
    toastStore.getState().info(message, options),
  success: (message: string, options?: Omit<ToastInput, "message" | "tone">) =>
    toastStore.getState().success(message, options),
  warning: (message: string, options?: Omit<ToastInput, "message" | "tone">) =>
    toastStore.getState().warning(message, options),
  error: (message: string, options?: Omit<ToastInput, "message" | "tone">) =>
    toastStore.getState().error(message, options),
  dismiss: (id: string, options?: { immediate?: boolean }) =>
    toastStore.getState().dismiss(id, options),
  clear: () => toastStore.getState().clear(),
};
