import { useEffect } from "react";
import { focusManager } from "@tanstack/react-query";
import { useI18n } from "./providers/i18n-provider";
import { supabase } from "@/lib/supabase";
import { isServerError, useSupabaseHealth } from "@/lib/supabase-health";
const PROBE_INTERVAL = 15_000;
export function ConnectionBanner() {
  const down = useSupabaseHealth((s) => s.down);
  const markHealthy = useSupabaseHealth((s) => s.markHealthy);
  const { t } = useI18n();
  useEffect(() => {
    if (!down) return;
    // Half-open the breaker: pause focus-driven refetches, then probe with a
    // cheap head request until Supabase stops answering 5xx.
    focusManager.setFocused(false);
    const probe = async () => {
      const r = await supabase
        .from("profiles_visible")
        .select("id", { count: "exact", head: true })
        .limit(1);
      if (!r.error || !isServerError(r.error)) {
        markHealthy();
        focusManager.setFocused(undefined);
      }
    };
    const timer = setInterval(() => void probe(), PROBE_INTERVAL);
    void probe();
    return () => {
      clearInterval(timer);
      focusManager.setFocused(undefined);
    };
  }, [down, markHealthy]);
  if (!down) return null;
  return (
    <div role="alert" className="connection-banner">
      {t("Connection issues — some content may be unavailable. Retrying…")}
    </div>
  );
}
