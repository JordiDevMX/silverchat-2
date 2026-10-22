import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { AuthFrame, InlineError } from "@/features/auth/components";
import { safeRedirect, searchParams } from "@/features/auth/navigation";
import { usernameSchema } from "@/features/auth/schemas";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
export function PickUsernamePage() {
  const auth = useAuth();
  const router = useRouter();
  const [savedUsername, setSavedUsername] = useState<string | null>(null);
  useEffect(() => {
    if (savedUsername && auth.profile?.username === savedUsername) {
      void router.navigate({
        href: `/onboarding/welcome?${new URLSearchParams({ redirect: safeRedirect(searchParams().get("redirect")) })}`,
      });
    }
  }, [savedUsername, auth.profile?.username, router]);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(usernameSchema), defaultValues: { username: "" } });
  const username = useWatch({ control, name: "username" });
  const submit = handleSubmit(async ({ username }) => {
    if (!auth.user) return;
    try {
      const available = await supabase
        .from("profiles_visible")
        .select("id")
        .eq("username", username)
        .neq("id", auth.user.id)
        .limit(1);
      if (available.error) throw available.error;
      if (available.data.length) {
        setError("username", { message: "This username is taken" });
        return;
      }
      const saved = await supabase.from("profiles").update({ username }).eq("id", auth.user.id);
      if (saved.error?.code === "23505") {
        setError("username", { message: "Someone just took this username. Try another." });
        return;
      }
      if (saved.error) throw saved.error;
      setSavedUsername(username);
      await auth.refreshUser();
    } catch {
      setError("root", { message: "We couldn’t save your username. Please try again." });
    }
  });
  return (
    <AuthFrame
      title="Pick your username"
      subtitle="This is how others will find you. You can’t change it easily."
    >
      <form onSubmit={submit} noValidate>
        <label htmlFor="username">Username</label>
        <div className="input-with-icon">
          <span aria-hidden="true">@</span>
          <input
            id="username"
            autoCapitalize="none"
            autoComplete="username"
            spellCheck={false}
            aria-invalid={!!errors.username}
            {...register("username")}
          />
        </div>
        <p className="quiet-note">Your handle: @{username || "your_name"}</p>
        <InlineError>{errors.username?.message || errors.root?.message}</InlineError>
        <button className="button primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Saving…" : "Continue"}
        </button>
      </form>
    </AuthFrame>
  );
}
