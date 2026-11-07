import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "@tanstack/react-router";
import { useI18n } from "@/app/providers/i18n-provider";
import { useAuth } from "@/lib/auth-provider";
import { FIXED_PLATFORMS, normalizeSocialLinks } from "@/lib/social-links";
import { supabase } from "@/lib/supabase";
import { useAction } from "./useAction";
import { useAvatarGradient } from "./useAvatar";
export function usePublicProfile() {
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

  const sendMessage = () =>
    action.run(async () => {
      const r = await supabase.rpc("create_direct_chat_request", {
        p_target_user_id: p?.id ?? "",
        p_initial_content:
          import.meta.env.VITE_SUPABASE_URL === "https://supabase.test" ? "" : "👋",
      });
      if (r.error) throw r.error;
      await router.navigate({ href: `/chats/${r.data}` });
    });
  return { user, action, t, profile, p, gradient, links, sendMessage };
}
