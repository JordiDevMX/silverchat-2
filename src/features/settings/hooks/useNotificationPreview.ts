import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { inAppNotification, playNotificationSound } from "../notifications";
export function useNotificationPreview() {
  const [preview, setPreview] = useState("");
  const { t } = useI18n();
  const showPreview = (settings: Parameters<typeof inAppNotification>[0]) => {
    const result = inAppNotification(
      settings,
      t("This is how your message previews look."),
      t("New message"),
    );
    if (result) {
      setPreview(result.text);
      if (result.sound) void playNotificationSound().catch(() => undefined);
    }
  };
  return { preview, setPreview, showPreview };
}
