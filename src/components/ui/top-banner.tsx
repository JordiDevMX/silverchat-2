import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { InfrastructureNotice } from "./auth-surfaces";

export type TopBannerTone = "danger" | "warning" | "info";

export interface TopBannerProps {
  children: ReactNode;
  tone?: TopBannerTone;
  role?: "status" | "alert";
  icon?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
}

/**
 * Reusable fixed top-of-viewport banner for infrastructure and security alerts.
 */
export function TopBanner({
  children,
  tone = "info",
  role,
  icon,
  action,
  onDismiss,
  dismissLabel = "Dismiss",
  className,
}: TopBannerProps) {
  const resolvedRole = role ?? (tone === "danger" ? "alert" : "status");
  return (
    <div className={cn("top-banner", `top-banner-${tone}`, className)} data-tone={tone}>
      <div className="top-banner-inner">
        <InfrastructureNotice role={resolvedRole} icon={icon}>
          <div className="top-banner-content">
            <span>{children}</span>
            {action && <span className="top-banner-action">{action}</span>}
          </div>
        </InfrastructureNotice>
        {onDismiss && (
          <button
            type="button"
            className="top-banner-dismiss"
            aria-label={dismissLabel}
            onClick={onDismiss}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
