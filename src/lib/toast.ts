import { useStore } from "zustand";
import {
  type ToastInput,
  type ToastRecord,
  type ToastTone,
  toast,
  toastStore,
} from "./toast-store";

export type {
  ToastAction,
  ToastInput,
  ToastRecord,
  ToastStoreState,
  ToastTone,
} from "./toast-store";
export {
  createToastStore,
  MAX_VISIBLE_TOASTS,
  TOAST_DURATION_MS,
  TOAST_EXIT_MS,
  toast,
  toastStore,
} from "./toast-store";

/**
 * React hook for reading active toasts and triggering/dismissing notifications
 * consistently from any SilverChat component or hook.
 */
export function useToast() {
  const toasts = useStore(toastStore, (state) => state.toasts);
  const show = useStore(toastStore, (state) => state.show);
  const info = useStore(toastStore, (state) => state.info);
  const success = useStore(toastStore, (state) => state.success);
  const warning = useStore(toastStore, (state) => state.warning);
  const error = useStore(toastStore, (state) => state.error);
  const dismiss = useStore(toastStore, (state) => state.dismiss);
  const pause = useStore(toastStore, (state) => state.pause);
  const resume = useStore(toastStore, (state) => state.resume);
  const clear = useStore(toastStore, (state) => state.clear);

  return {
    toasts,
    show,
    info,
    success,
    warning,
    error,
    dismiss,
    pause,
    resume,
    clear,
  };
}

export type { ToastInput as ToastOptions, ToastRecord as ToastItem, ToastTone as ToastVariant };
export { toast as notifyToast };
