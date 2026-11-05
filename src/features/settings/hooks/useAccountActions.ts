import { useRouter } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { refreshSession } from "@/lib/auth";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { useProfile, useProfileRefresh } from "../hooks";
import { useAction } from "./useAction";
export function useDeletionCancellation() {
  const profile = useProfile();
  const refresh = useProfileRefresh();
  const action = useAction();
  const { t, language } = useI18n();
  const cancelDeletion = () =>
    action.run(async () => {
      const r = await supabase.rpc("cancel_account_deletion");
      if (r.error) throw r.error;
      await refresh();
    });
  return { profile, action, t, language, cancelDeletion };
}
export function useAccountActions() {
  const cancellation = useDeletionCancellation();
  const auth = useAuth();
  const router = useRouter();
  const switchAccount = () =>
    cancellation.action.run(async () => {
      await auth.signOut();
      await router.navigate({ href: "/auth/login" });
    });
  return { ...cancellation, auth, switchAccount };
}
export function useEmailChange() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const action = useAction();
  const { t, language } = useI18n();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void action.run(async () => {
      await refreshSession({ action: "change_email", email: email.trim() });
      setSent(true);
    });
  };
  return { email, setEmail, sent, action, t, language, submit };
}
export function useAccountDeletion(onClose: () => void) {
  const [confirmation, setConfirmation] = useState("");
  const action = useAction();
  const refresh = useProfileRefresh();
  const { t } = useI18n();
  const scheduleDeletion = () =>
    action.run(async () => {
      const r = await supabase.rpc("schedule_account_deletion");
      if (r.error) throw r.error;
      await refresh();
      onClose();
    });
  return { confirmation, setConfirmation, action, t, scheduleDeletion };
}
