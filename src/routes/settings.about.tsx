import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { BrandMark } from "@/components/ui/brand-lockup";
import { Button } from "@/components/ui/button";
import { LogoutConfirmModal } from "@/features/settings/components/LogoutConfirmModal";
import { SettingsPage } from "@/features/settings/components/presentation";
export function AboutPage() {
  const [logout, setLogout] = useState(false);
  const { t } = useI18n();
  return (
    <SettingsPage title="About">
      <div className="about-identity">
        <BrandMark className="size-16 rounded-2xl text-3xl" />
        <h2>SilverChat</h2>
        <p>
          {t("Version")} {import.meta.env.VITE_APP_VERSION}
        </p>
      </div>
      <div className="settings-card">
        {["Terms of Service", "Privacy Policy"].map((label) => (
          <div className="storage-row" key={label}>
            <span>{t(label)}</span>
            <small>{t("Coming soon")}</small>
          </div>
        ))}
      </div>
      <details className="settings-card settings-card-body">
        <summary>{t("Open-source licenses")}</summary>
        <ul>
          {[
            ["React", "https://github.com/facebook/react/blob/main/LICENSE"],
            ["Supabase", "https://github.com/supabase/supabase-js/blob/master/LICENSE"],
            ["Lucide", "https://lucide.dev/license"],
            ["TanStack", "https://github.com/TanStack/router/blob/main/LICENSE"],
            ["react-easy-crop", "https://github.com/ValentinH/react-easy-crop/blob/main/LICENSE"],
            [
              "browser-image-compression",
              "https://github.com/Donaldcwl/browser-image-compression/blob/master/LICENSE",
            ],
          ].map(([label, href]) => (
            <li key={label}>
              <a href={href} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </details>
      <Button variant="destructive" type="button" onClick={() => setLogout(true)}>
        {t("Log out")}
      </Button>
      {logout && <LogoutConfirmModal onClose={() => setLogout(false)} />}
    </SettingsPage>
  );
}
