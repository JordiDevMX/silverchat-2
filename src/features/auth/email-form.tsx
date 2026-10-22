import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useRouter } from "@tanstack/react-router";
import { ArrowRight, Mail } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/lib/auth-provider";
import { AuthFrame, InlineError } from "./components";
import { safeRedirect, searchParams } from "./navigation";
import { emailSchema } from "./schemas";
export function EmailForm({ signup = false }: { signup?: boolean }) {
  const auth = useAuth();
  const router = useRouter();
  const widget = useRef<TurnstileInstance>(null);
  const [token, setToken] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } });
  const redirect = safeRedirect(searchParams().get("redirect"));
  const submit = handleSubmit(async ({ email }) => {
    try {
      await auth.signIn(email, signup ? "signup" : "login", redirect, token ?? undefined);
      await router.navigate({
        href: `/auth/check-email?${new URLSearchParams({ email, redirect, mode: signup ? "signup" : "login" })}`,
      });
    } catch {
      setError("root", { message: "We couldn’t send a link. Please try again in a moment." });
    } finally {
      if (signup) {
        setToken(null);
        widget.current?.reset();
      }
    }
  });
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
          <input
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
        <button
          className="button primary"
          disabled={isSubmitting || (signup && !token)}
          type="submit"
        >
          {isSubmitting ? "Sending your link…" : signup ? "Create account" : "Send magic link"}
          <ArrowRight aria-hidden="true" size={18} />
        </button>
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
