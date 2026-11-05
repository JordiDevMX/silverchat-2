import { WifiOff } from "lucide-react";
import { InfrastructureNotice } from "@/components/ui/auth-surfaces";
import { useConnectionHealth } from "@/lib/use-connection-health";
import { useI18n } from "./providers/i18n-provider";
export function ConnectionBanner() {
  const down = useConnectionHealth();
  const { t } = useI18n();
  if (!down) return null;
  return (
    <div className="connection-banner connection-banner-v2">
      <InfrastructureNotice role="alert" icon={<WifiOff size={18} />}>
        {t("Connection issues — some content may be unavailable. Retrying…")}
      </InfrastructureNotice>
    </div>
  );
}
