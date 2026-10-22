import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/app/providers/i18n-provider";
import { Avatar, QueryState, SettingsPage, useAction } from "@/features/settings/components/shared";
import { useBlockedUsers } from "@/features/settings/hooks";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
export function BlockedContactsPage() {
  const blocked = useBlockedUsers();
  const { user } = useAuth();
  const cache = useQueryClient();
  const action = useAction();
  const { t } = useI18n();
  return (
    <SettingsPage title="Blocked contacts">
      <p>
        {blocked.data?.length ?? 0} {t("Blocked contacts").toLowerCase()}
      </p>
      <QueryState
        loading={blocked.isLoading}
        error={blocked.error}
        retry={() => void blocked.refetch()}
      />
      <div className="settings-card">
        {blocked.data?.map((profile) => (
          <div className="contact-row" key={profile.id}>
            <Avatar profile={profile} size="small" />
            <span>
              <strong>{profile.display_name}</strong>
              <small>@{profile.username}</small>
            </span>
            <button
              className="button secondary"
              type="button"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  const previous = blocked.data;
                  await cache.cancelQueries({ queryKey: ["blocked", user?.id] });
                  cache.setQueryData(
                    ["blocked", user?.id],
                    previous?.filter((p) => p.id !== profile.id),
                  );
                  const r = await supabase
                    .from("user_blocks")
                    .delete()
                    .eq("blocker_id", user?.id ?? "")
                    .eq("blocked_id", profile.id ?? "");
                  if (r.error) {
                    cache.setQueryData(["blocked", user?.id], previous);
                    throw r.error;
                  }
                  await Promise.all(
                    ["blocked", "contacts", "public-profile", "chats"].map((key) =>
                      cache.invalidateQueries({ queryKey: [key] }),
                    ),
                  );
                }, "Unblocked")
              }
            >
              {t("Unblock")}
            </button>
          </div>
        ))}
      </div>
      {blocked.data?.length === 0 && (
        <p className="settings-empty">{t("You haven’t blocked anyone.")}</p>
      )}
      {action.feedback}
    </SettingsPage>
  );
}
