import { Turnstile } from "@marsidev/react-turnstile";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEmailForm } from "@/features/auth/hooks/useEmailForm";
import { AuthFrame, InlineError } from "./components";
import { useAuthText } from "./i18n";
export function EmailForm({ signup = false }: { signup?: boolean }) {
  const { widget, setToken, token, register, errors, isSubmitting, redirect, submit } =
    useEmailForm({ signup });
  const t = useAuthText();
  return (
    <AuthFrame
      title={signup ? t("Create your account") : t("Welcome back")}
      subtitle={
        signup
          ? t("We’ll send you a magic link — no password needed.")
          : t("Your next conversation starts here. Sign in with your email.")
      }
    >
      <form onSubmit={submit} noValidate>
        <label htmlFor="email">{t("Email address")}</label>
        <div className="input-with-icon">
          <Mail aria-hidden="true" size={20} strokeWidth={1.75} />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
        </div>
        <div id="email-error">
          <InlineError>{t(errors.email?.message)}</InlineError>
        </div>
        {signup &&
          (import.meta.env.VITE_TURNSTILE_SITE_KEY ? (
            <Turnstile
              ref={widget}
              siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
              options={{ theme: "auto", size: "flexible", action: "signup" }}
              onSuccess={setToken}
              onError={() => setToken(null)}
              onExpire={() => setToken(null)}
            />
          ) : (
            <InlineError>
              {t("Account creation is temporarily unavailable. Please try again later.")}
            </InlineError>
          ))}
        <InlineError>{t(errors.root?.message)}</InlineError>
        <Button disabled={isSubmitting || (signup && !token)} type="submit">
          {isSubmitting
            ? t("Sending your link…")
            : signup
              ? t("Create account")
              : t("Send magic link")}
          <ArrowRight aria-hidden="true" size={18} />
        </Button>
      </form>
      <p className="form-footer">
        {signup ? t("Already have an account?") : t("Don’t have an account?")}{" "}
        <a href={`/auth/${signup ? "login" : "signup"}?${new URLSearchParams({ redirect })}`}>
          {signup ? t("Log in") : t("Sign up")}
        </a>
      </p>
      <p className="quiet-note">{t("No passwords to remember. Just you and your inbox.")}</p>
    </AuthFrame>
  );
}
