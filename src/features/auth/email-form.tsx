import { Turnstile } from "@marsidev/react-turnstile";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEmailForm } from "@/features/auth/hooks/useEmailForm";
import { AuthFrame, InlineError } from "./components";
export function EmailForm({ signup = false }: { signup?: boolean }) {
  const { widget, setToken, token, register, errors, isSubmitting, redirect, submit } =
    useEmailForm({ signup });
  return (
    <AuthFrame
      title={signup ? "Create your account" : "Welcome back"}
      subtitle={
        signup
          ? "We’ll send you a magic link — no password needed."
          : "Your next conversation starts here. Sign in with your email."
      }
    >
      <form onSubmit={submit} noValidate>
        <label htmlFor="email">Email address</label>
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
          <InlineError>{errors.email?.message}</InlineError>
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
              Account creation is temporarily unavailable. Please try again later.
            </InlineError>
          ))}
        <InlineError>{errors.root?.message}</InlineError>
        <Button disabled={isSubmitting || (signup && !token)} type="submit">
          {isSubmitting ? "Sending your link…" : signup ? "Create account" : "Send magic link"}
          <ArrowRight aria-hidden="true" size={18} />
        </Button>
      </form>
      <p className="form-footer">
        {signup ? "Already have an account?" : "Don’t have an account?"}{" "}
        <a href={`/auth/${signup ? "login" : "signup"}?${new URLSearchParams({ redirect })}`}>
          {signup ? "Log in" : "Sign up"}
        </a>
      </p>
      <p className="quiet-note">No passwords to remember. Just you and your inbox.</p>
    </AuthFrame>
  );
}
