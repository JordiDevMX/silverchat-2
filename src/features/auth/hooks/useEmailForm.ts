import { zodResolver } from "@hookform/resolvers/zod";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { safeRedirect, searchParams } from "@/features/auth/navigation";
import { emailSchema } from "@/features/auth/schemas";
import { useAuth } from "@/lib/auth-provider";
export function useEmailForm({ signup = false }: { signup?: boolean }) {
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
  return { auth, widget, setToken, token, register, errors, isSubmitting, redirect, submit };
}
