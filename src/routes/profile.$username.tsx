import { Button } from "@/components/ui/button";
import { PublicProfileSurface } from "@/components/ui/public-profile-surface";
import { Avatar, NavLink, QueryState } from "@/features/settings/components/shared";
import { usePublicProfile } from "@/features/settings/hooks/usePublicProfile";
import { socialHref } from "@/lib/social-links";
import "@/styles/settings.css";
export function PublicProfilePage() {
  const { user, action, t, profile, p, gradient, links, sendMessage } = usePublicProfile();
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
        <section>
          <h1>{t("Profile unavailable")}</h1>
          <p>{t("This profile is unavailable or hidden by privacy settings.")}</p>
        </section>
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
            <Button
              type="button"
              disabled={action.busy || !p.id}
              onClick={() => void sendMessage()}
            >
              {t("Send message")}
            </Button>
          )}
          {action.feedback}
        </PublicProfileSurface>
      )}
    </main>
  );
}
