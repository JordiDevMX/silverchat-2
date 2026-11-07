import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { InlineError } from "@/components/ui/inline-error";

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
