import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { nextDestination, safeRedirect, searchParams } from "@/features/auth/navigation";
import { backupSchema, totpSchema } from "@/features/auth/schemas";
import { useAuth } from "@/lib/auth-provider";
export function useMfaVerification() {
  const auth = useAuth();
  const router = useRouter();
  const [backup, setBackup] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(backup ? backupSchema : totpSchema),
    defaultValues: { code: "" },
  });
  const redirect = safeRedirect(searchParams().get("redirect"));
  useEffect(() => {
    if (!auth.user)
      void router.navigate({
        href: `/auth/login?${new URLSearchParams({ redirect })}`,
        replace: true,
      });
    else if (!auth.mfaRequired && auth.profile)
      void router.navigate({
        href: nextDestination(auth.profile.username, redirect),
        replace: true,
      });
  }, [auth.user, auth.mfaRequired, auth.profile, router, redirect]);
  const submit = handleSubmit(async ({ code }) => {
    try {
      if (backup) await auth.completeMfaWithBackupCode(code);
      else await auth.completeMfa(code);
    } catch {
      setError("root", {
        message: backup
          ? "That backup code couldn’t be verified. Try another code or request a new magic link."
          : "That code couldn’t be verified. Check your authenticator and try again.",
      });
    }
  });
  return { backup, setBackup, register, control, reset, errors, isSubmitting, submit };
}
