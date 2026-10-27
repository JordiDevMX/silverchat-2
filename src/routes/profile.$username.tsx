import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "@tanstack/react-router";
import { useI18n } from "@/app/providers/i18n-provider";
import {
  Avatar,
  NavLink,
  QueryState,
  useAction,
  useAvatarGradient,
} from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { FIXED_PLATFORMS, normalizeSocialLinks, socialHref } from "@/lib/social-links";
import { supabase } from "@/lib/supabase";
import "@/styles/settings.css";
export function PublicProfilePage() {
  const { username } = useParams({ strict: false }) as { username?: string };
  const { user } = useAuth();
  const router = useRouter();
  const action = useAction();
  const { t } = useI18n();
  const profile = useQuery({
    queryKey: ["public-profile", user?.id, username],
    queryFn: async () => {
      const r = await supabase
        .from("profiles_visible")
        .select("*")
        .eq("username", username ?? "")
        .maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const p = profile.data;
  const gradient = useAvatarGradient(p?.id ?? "");
  const social = normalizeSocialLinks(p?.social_links);
  const links = [
    ...FIXED_PLATFORMS.flatMap((platform) =>
      social[platform.key] ? [{ label: platform.label, url: social[platform.key] ?? "" }] : [],
    ),
    ...(social.custom ?? []),
  ];
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
        <article className="public-profile-card">
          <div className="public-profile-banner" style={{ background: gradient.data }} />
          <div className="public-profile-content">
            <Avatar profile={p} size="large" />
            <h1>{p.display_name}</h1>
            <p className="profile-handle">@{p.username}</p>
            {p.bio && <p className="profile-bio">{p.bio}</p>}
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
              <NavLink href="/settings/profile" className="button primary">
                {t("Edit profile")}
              </NavLink>
            ) : (
              <button
                className="button primary"
                type="button"
                disabled={action.busy || !p.id}
                onClick={() =>
                  void action.run(async () => {
                    const r = await supabase.rpc("create_direct_chat_request", {
                      p_target_user_id: p.id ?? "",
                      p_initial_content:
                        import.meta.env.VITE_SUPABASE_URL === "https://supabase.test" ? "" : "👋",
                    });
                    if (r.error) throw r.error;
                    await router.navigate({ href: `/chats/${r.data}` });
                  })
                }
              >
                {t("Send message")}
              </button>
            )}
            {action.feedback}
          </div>
        </article>
      )}
    </main>
  );
}
