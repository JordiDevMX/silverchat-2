import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { type PropsWithChildren, type ReactNode, useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { InlineError } from "@/features/auth/components";
import { useAuth } from "@/lib/auth-provider";
import { getCSSGradient, getGradientForUser, getInitials } from "@/lib/avatar";
import { supabase } from "@/lib/supabase";
export function NavLink({
  href,
  children,
  className = "",
}: PropsWithChildren<{ href: string; className?: string }>) {
  const router = useRouter();
  return (
    <a
      href={href}
      className={className}
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
    <NavLink href={href} className="setting-row">
      <span className="setting-row-icon">{icon}</span>
      <span className="setting-row-text">
        <strong>{t(label)}</strong>
        {detail && <small>{t(detail)}</small>}
      </span>
      <ChevronRight size={18} aria-hidden="true" />
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
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { t } = useI18n();
  const run = async (action: () => Promise<void>, message = "") => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return {
    busy,
    error,
    notice,
    run,
    feedback: (
      <>
        <InlineError>{t(error)}</InlineError>
        {notice && (
          <p className="settings-notice" role="status">
            {t(notice)}
          </p>
        )}
      </>
    ),
  };
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
    <p role="status">{t("Loading…")}</p>
  ) : error ? (
    <div>
      <InlineError>{t("Something went wrong. Please try again.")}</InlineError>
      {retry && (
        <button className="button secondary" type="button" onClick={retry}>
          {t("Try again")}
        </button>
      )}
    </div>
  ) : null;
}
export function useAvatarGradient(id: string) {
  return useQuery({
    queryKey: ["avatar-gradient", id],
    queryFn: async () => getCSSGradient(await getGradientForUser(id)),
    staleTime: Infinity,
  });
}
export function useAvatarUrl(path: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["avatar-url", user?.id, path],
    enabled: !!path && !!user,
    staleTime: 40_000,
    refetchInterval: 45_000,
    queryFn: async () => {
      const r = await supabase.storage.from("avatars").createSignedUrl(path ?? "", 60);
      if (r.error) throw r.error;
      return r.data.signedUrl;
    },
    retry: false,
  });
}
export function Avatar({
  profile,
  size = "medium",
}: {
  profile: {
    id?: string | null;
    display_name?: string | null;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    avatar_url?: string | null;
    avatar_initials?: string | null;
  };
  size?: "small" | "medium" | "large";
}) {
  const gradient = useAvatarGradient(profile.id ?? "");
  const url = useAvatarUrl(profile.avatar_url);
  const [broken, setBroken] = useState<string>();
  const initials = getInitials({
    ...profile,
    display_name: profile.display_name ?? "",
    username: profile.username ?? "",
  });
  return (
    <span className={`avatar avatar-${size}`} style={{ background: gradient.data }}>
      {url.data && broken !== url.data ? (
        <img src={url.data} alt="" onError={() => setBroken(url.data)} />
      ) : (
        <span aria-hidden="true">{profile.avatar_initials ?? initials}</span>
      )}
    </span>
  );
}
