import { LockKeyhole } from "lucide-react";
import { Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthFrame, CodeInput, InlineError } from "@/features/auth/components";
import { useMfaVerification } from "@/features/auth/hooks/useMfaVerification";
export function MfaVerifyPage() {
  const { backup, setBackup, register, control, reset, errors, isSubmitting, submit } =
    useMfaVerification();
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
            <Input
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
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Verifying…" : "Verify"}
        </Button>
      </form>
      <Button
        type="button"
        variant="ghost"
        disabled={isSubmitting}
        onClick={() => {
          setBackup(!backup);
          reset({ code: "" });
        }}
      >
        {backup ? "Use authenticator instead" : "Lost access? Use a backup code instead"}
      </Button>
    </AuthFrame>
  );
}
