import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { TopBanner } from "@/components/ui/top-banner";
import { useAuth } from "@/lib/auth-provider";
import { getOrCreateDeviceFingerprint } from "@/lib/devices";
import {
  type DeviceRecord,
  dismissDeviceAlert,
  dismissReenrollmentBanner,
  findNewDeviceAlert,
  readDeviceAlertState,
  shouldShowReenrollmentBanner,
  syncReenrollmentDismissal,
  writeDeviceAlertState,
} from "@/lib/security-banners";
import { supabase } from "@/lib/supabase";
import { useSupabaseHealth } from "@/lib/supabase-health";
import { useI18n } from "./providers/i18n-provider";

const DEVICE_POLL_INTERVAL_MS = 60_000;

function getStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function SecurityBanners() {
  const auth = useAuth();
  const down = useSupabaseHealth((s) => s.down);
  const { t, language } = useI18n();
  const user = auth.user;
  const userId = user?.id ?? null;
  const active = Boolean(user && !auth.mfaRequired);
  const requiresReenrollment = Boolean(user?.user_metadata.requires_reenrollment);
  const hasVerifiedFactor = Boolean(user?.factors?.some((factor) => factor.status === "verified"));

  const [newDevice, setNewDevice] = useState<DeviceRecord | null>(null);
  const [reenrollVisible, setReenrollVisible] = useState(false);

  useEffect(() => {
    if (!userId || !active) {
      setReenrollVisible(false);
      return;
    }
    const storage = getStorage();
    const check = { userId, requiresReenrollment, hasVerifiedFactor };
    syncReenrollmentDismissal(check, storage);
    setReenrollVisible(shouldShowReenrollmentBanner(check, storage));
  }, [active, hasVerifiedFactor, requiresReenrollment, userId]);

  useEffect(() => {
    if (!userId || !active) {
      setNewDevice(null);
      return;
    }
    let cancelled = false;
    const checkDevices = async () => {
      const { data, error } = await supabase
        .from("devices")
        .select("id, device_name, device_fingerprint, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (cancelled || error || !data) return;
      const storage = getStorage();
      const stored = readDeviceAlertState(storage, userId);
      const { alertDevice, nextState } = findNewDeviceAlert(
        data,
        getOrCreateDeviceFingerprint(),
        stored,
        new Date().toISOString(),
      );
      if (!stored) writeDeviceAlertState(storage, userId, nextState);
      setNewDevice(alertDevice);
    };

    void checkDevices();
    const handleFocus = () => {
      void checkDevices();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkDevices();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkDevices();
    }, DEVICE_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(timer);
    };
  }, [active, userId]);

  const handleDismissDevice = useCallback(() => {
    if (!userId || !newDevice) return;
    const storage = getStorage();
    const current = readDeviceAlertState(storage, userId) ?? {
      baselineAt: new Date().toISOString(),
      dismissedIds: [],
    };
    writeDeviceAlertState(storage, userId, dismissDeviceAlert(current, newDevice));
    setNewDevice(null);
  }, [newDevice, userId]);

  const handleDismissReenroll = useCallback(() => {
    if (!userId) return;
    dismissReenrollmentBanner(userId, getStorage());
    setReenrollVisible(false);
  }, [userId]);

  if (!active || down) return null;

  if (newDevice) {
    const message =
      language === "es"
        ? `Nuevo inicio de sesión detectado en ${newDevice.device_name}.`
        : `New sign-in detected on ${newDevice.device_name}.`;
    return (
      <TopBanner
        tone="warning"
        role="status"
        icon={<ShieldAlert size={18} />}
        action={
          <Link to="/settings/devices" onClick={handleDismissDevice}>
            {t("Review devices")}
          </Link>
        }
        onDismiss={handleDismissDevice}
        dismissLabel={t("Dismiss")}
      >
        {message}
      </TopBanner>
    );
  }

  if (reenrollVisible) {
    return (
      <TopBanner
        tone="warning"
        role="status"
        icon={<ShieldAlert size={18} />}
        action={<Link to="/settings/security">{t("Open security settings")}</Link>}
        onDismiss={handleDismissReenroll}
        dismissLabel={t("Dismiss")}
      >
        {t("Backup code used. Please re-enable 2FA in settings.")}
      </TopBanner>
    );
  }

  return null;
}
