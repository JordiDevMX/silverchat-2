import { useRouter } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { type PropsWithChildren, type ReactNode, useRef } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { InfrastructureNotice } from "@/components/ui/auth-surfaces";
import { Avatar as AvatarPrimitive } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SettingsRowContent, settingsRowClassName } from "@/components/ui/settings-row";
import { Skeleton } from "@/components/ui/skeleton";
import { useInView } from "@/hooks/useInView";
import { getInitials } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { useAvatarGradient, useAvatarUrl } from "../hooks/useAvatar";

export { useAction } from "../hooks/useAction";
export { useAvatarGradient, useAvatarUrl } from "../hooks/useAvatar";

export function NavLink({
  href,
  children,
  className = "",
  "aria-current": ariaCurrent,
}: PropsWithChildren<{ href: string; className?: string; "aria-current"?: "page" }>) {
  const router = useRouter();
  return (
    <a
      href={href}
      className={className}
      aria-current={ariaCurrent}
      onClick={(event) => {
        if (
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          void router.navigate({ href });
        }
      }}
    >
      {children}
    </a>
  );
}

export function SettingsPage({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description?: string }>) {
  const { t } = useI18n();
  return (
    <section className="settings-page">
      <header className="settings-page-heading">
        <h1>{t(title)}</h1>
        {description && <p>{t(description)}</p>}
      </header>
      {children}
    </section>
  );
}

export function SettingRow({
  href,
  label,
  detail,
  icon,
}: {
  href: string;
  label: string;
  detail?: string;
  icon?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <NavLink href={href} className={cn("setting-row", settingsRowClassName)}>
      <SettingsRowContent
        label={t(label)}
        subtitle={detail && t(detail)}
        icon={icon}
        right={
          <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        }
      />
    </NavLink>
  );
}

export function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="toggle-row">
      <span>
        <strong>{t(label)}</strong>
        {description && <small>{t(description)}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function QueryState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: unknown;
  retry?: () => void;
}) {
  const { t } = useI18n();
  return loading ? (
    <div role="status" aria-busy="true" className="query-state-loading">
      <span>{t("Loading…")}</span>
      <Skeleton className="h-3 w-32 mt-3" />
    </div>
  ) : error ? (
    <InfrastructureNotice role="alert">
      <p className="form-error">{t("Something went wrong. Please try again.")}</p>
      {retry && (
        <Button variant="outline" type="button" onClick={retry}>
          {t("Try again")}
        </Button>
      )}
    </InfrastructureNotice>
  ) : null;
}

export function Avatar({
  profile,
  size = "medium",
  enabled = true,
}: {
  profile: {
    id?: string | null;
    display_name?: string | null;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    avatar_url?: string | null;
    initials?: string | null;
  };
  size?: "small" | "medium" | "large";
  enabled?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { rootMargin: "100px" });
  const gradient = useAvatarGradient(profile.id ?? "");
  const url = useAvatarUrl(profile.avatar_url, { enabled: enabled && isInView });
  const initials = getInitials({
    ...profile,
    display_name: profile.display_name ?? "",
    username: profile.username ?? "",
  });
  return (
    <AvatarPrimitive
      ref={ref}
      className={cn("avatar", {
        "avatar-small size-[38px] text-xs": size === "small",
        "avatar-medium size-[52px] text-lg": size === "medium",
        "avatar-large size-[100px] text-[2rem]": size === "large",
      })}
      src={url.data}
      gradient={gradient.data}
      initials={profile.initials ?? initials}
    />
  );
}
