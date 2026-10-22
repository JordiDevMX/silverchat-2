import { useI18n } from "@/app/providers/i18n-provider";
import { supabase } from "@/lib/supabase";
import { useProfile, useProfileRefresh } from "../hooks";
import { useAction } from "./shared";
export function PendingDeletionBanner() {
  const profile = useProfile();
  const refresh = useProfileRefresh();
  const action = useAction();
  const { language, t } = useI18n();
  if (!profile.data?.scheduled_deletion_at) return null;
  const expired = new Date(profile.data.scheduled_deletion_at).getTime() <= Date.now();
  const date = new Date(profile.data.scheduled_deletion_at).toLocaleDateString(language, {
    dateStyle: "long",
  });
  return (
    <aside className="deletion-banner" aria-label={t("Delete account")}>
      <span>
        {language === "es"
          ? `Tu cuenta se eliminará el ${date}.`
          : `Your account will be deleted on ${date}.`}
      </span>
      <button
        type="button"
        disabled={action.busy || expired}
        onClick={() =>
          void action.run(async () => {
            const r = await supabase.rpc("cancel_account_deletion");
            if (r.error) throw r.error;
            await refresh();
          })
        }
      >
        {expired
          ? language === "es"
            ? "Eliminación en curso"
            : "Deletion in progress"
          : t("Cancel deletion")}
      </button>
      {action.feedback}
    </aside>
  );
}
