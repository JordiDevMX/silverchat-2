import { Flag } from "lucide-react";
import { useState } from "react";
import { InfrastructureNotice } from "@/components/ui/auth-surfaces";
import { Button } from "@/components/ui/button";
import { PublicProfileSurface } from "@/components/ui/public-profile-surface";
import { ReportModal } from "@/features/chat-settings/components/ReportModal";
import { Avatar, NavLink, QueryState } from "@/features/settings/components/shared";
import { usePublicProfile } from "@/features/settings/hooks/usePublicProfile";
import { socialHref } from "@/lib/social-links";
import "@/styles/settings.css";
export function PublicProfilePage() {
  const { user, action, t, profile, p, gradient, links, sendMessage } = usePublicProfile();
  const [reportOpen, setReportOpen] = useState(false);
  return (
    <main id="main" className="public-profile-shell">
      <NavLink href="/settings" className="settings-back">
        ← {t("Settings")}
      </NavLink>
      <QueryState
        loading={profile.isLoading}
        error={profile.error}
        retry={() => void profile.refetch()}
      />
      {!profile.isLoading && !profile.error && !p && (
        <InfrastructureNotice>
          <h1>{t("Profile unavailable")}</h1>
          <p>{t("This profile is unavailable or hidden by privacy settings.")}</p>
        </InfrastructureNotice>
      )}
      {p && (
        <PublicProfileSurface
          gradient={gradient.data}
          avatar={<Avatar profile={p} size="large" />}
          name={p.display_name ?? ""}
          username={p.username ?? ""}
          bio={p.bio}
        >
          <div className="social-pills">
            {Array.from(
              new Map(links.map((link) => [`${link.label}:${link.url}`, link])).values(),
            ).map((link) => {
              const href = socialHref(link.url);
              return href ? (
                <a
                  key={`${link.label}:${link.url}`}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label || link.url}
                </a>
              ) : (
                <span key={`${link.label}:${link.url}`}>
                  {link.label}
                  {link.label && link.url ? " · " : ""}
                  {link.url}
                </span>
              );
            })}
          </div>
          {p.id === user?.id ? (
            <Button asChild>
              <NavLink href="/settings/profile">{t("Edit profile")}</NavLink>
            </Button>
          ) : (
            <div className="public-profile-actions">
              <Button
                type="button"
                disabled={action.busy || !p.id}
                onClick={() => void sendMessage()}
              >
                {t("Send message")}
              </Button>
              {p.id && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={action.busy}
                  onClick={() => setReportOpen(true)}
                >
                  <Flag size={16} aria-hidden="true" />
                  {t("Report")}
                </Button>
              )}
            </div>
          )}
          {action.feedback}
        </PublicProfileSurface>
      )}
      {reportOpen && p?.id && p.id !== user?.id && (
        <ReportModal
          target={{
            kind: "user",
            userId: p.id,
            name: p.display_name || p.username || "",
            username: p.username,
            blockUserId: p.id,
          }}
          onClose={() => setReportOpen(false)}
        />
      )}
    </main>
  );
}
