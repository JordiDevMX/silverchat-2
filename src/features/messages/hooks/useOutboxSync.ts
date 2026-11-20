import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-provider";
import {
  clearOutboxRetryTimer,
  flushOutbox,
  hydrateOutboxCache,
  resetOutboxBackoff,
} from "../lib/outboxSync";

export function useOutboxSync() {
  const { user, mfaRequired } = useAuth();
  const cache = useQueryClient();
  const userId = user && !mfaRequired ? user.id : "";

  useEffect(() => {
    if (!userId) return;
    hydrateOutboxCache(cache, userId);
    if (typeof navigator === "undefined" || navigator.onLine !== false) {
      void flushOutbox(cache, userId);
    }

    const onOnline = () => {
      resetOutboxBackoff(userId);
      void flushOutbox(cache, userId);
    };
    const onOffline = () => {
      clearOutboxRetryTimer(userId);
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === `silverchat_outbox_${userId}`) {
        hydrateOutboxCache(cache, userId);
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("storage", onStorage);
    return () => {
      clearOutboxRetryTimer(userId);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("storage", onStorage);
    };
  }, [cache, userId]);
}
