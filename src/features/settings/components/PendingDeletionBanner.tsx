import { Button } from "@/components/ui/button";
import { useDeletionCancellation } from "../hooks/useAccountActions";
export function PendingDeletionBanner() {
  const { profile, action, t, language, cancelDeletion } = useDeletionCancellation();
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
      <Button
        variant="outline"
        type="button"
        disabled={action.busy || expired}
        onClick={() => void cancelDeletion()}
      >
        {expired
          ? language === "es"
            ? "Eliminación en curso"
            : "Deletion in progress"
          : t("Cancel deletion")}
      </Button>
      {action.feedback}
    </aside>
  );
}
