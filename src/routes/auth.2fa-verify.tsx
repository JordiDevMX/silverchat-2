import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { AuthFrame, CodeInput, InlineError } from "@/features/auth/components";
import { nextDestination, safeRedirect, searchParams } from "@/features/auth/navigation";
import { backupSchema, totpSchema } from "@/features/auth/schemas";
import { useAuth } from "@/lib/auth-provider";
export function MfaVerifyPage() {
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
  return (
    <AuthFrame
      title="Two-factor authentication"
      subtitle={
        backup
          ? "Enter one of your saved backup codes."
          : "Enter the 6-digit code from your authenticator app."
      }
    >
      <LockKeyhole className="feature-icon" size={32} strokeWidth={1.75} aria-hidden="true" />
      <form onSubmit={submit} noValidate>
        {backup ? (
          <>
            <label htmlFor="backup-code">Backup code</label>
            <input
              id="backup-code"
              autoComplete="off"
              spellCheck={false}
              maxLength={10}
              {...register("code")}
            />
          </>
        ) : (
          <Controller
            name="code"
            control={control}
            render={({ field }) => (
              <CodeInput
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  if (value.length === 6 && !isSubmitting) void submit();
                }}
                invalid={!!errors.code}
              />
            )}
          />
        )}
        <InlineError>{errors.code?.message || errors.root?.message}</InlineError>
        <button className="button primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Verifying…" : "Verify"}
        </button>
      </form>
      <button
        type="button"
        className="text-link"
        disabled={isSubmitting}
        onClick={() => {
          setBackup(!backup);
          reset({ code: "" });
        }}
      >
        {backup ? "Use authenticator instead" : "Lost access? Use a backup code instead"}
      </button>
    </AuthFrame>
  );
}
