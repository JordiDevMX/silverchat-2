import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthFrame, InlineError } from "@/features/auth/components";
import { usePickUsername } from "@/features/auth/hooks/usePickUsername";
import { useAuthText } from "@/features/auth/i18n";
export function PickUsernamePage() {
  const { register, errors, isSubmitting, username, submit } = usePickUsername();
  const t = useAuthText();
  return (
    <AuthFrame
      title={t("Pick your username")}
      subtitle={t("This is how others will find you. You can’t change it easily.")}
    >
      <form onSubmit={submit} noValidate>
        <label htmlFor="username">{t("Username")}</label>
        <div className="input-with-icon">
          <span aria-hidden="true">@</span>
          <Input
            id="username"
            autoCapitalize="none"
            autoComplete="username"
            spellCheck={false}
            aria-invalid={!!errors.username}
            aria-describedby="username-help username-error"
            {...register("username")}
          />
        </div>
        <p id="username-help" className="quiet-note">
          {t("Your handle:")} @{username || "your_name"}
        </p>
        <div id="username-error">
          <InlineError>{t(errors.username?.message || errors.root?.message)}</InlineError>
        </div>
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? t("Saving…") : t("Continue")}
        </Button>
      </form>
    </AuthFrame>
  );
}
