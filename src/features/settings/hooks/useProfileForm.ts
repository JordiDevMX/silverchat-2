import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useI18n } from "@/app/providers/i18n-provider";
import { supabase } from "@/lib/supabase";
import { type Profile, useProfileRefresh } from "../hooks";

const schema = z.object({
  display_name: z.string().trim().min(1).max(50),
  first_name: z.string().trim().max(50),
  last_name: z.string().trim().max(50),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(20)
    .regex(/^[a-z0-9_]+$/)
    .refine((v) => !/^user_[a-f0-9]{8}$/.test(v), "Choose a different username"),
  bio: z.string().trim().max(160),
});

export function useProfileForm(profile: Profile) {
  const [notice, setNotice] = useState("");
  const refresh = useProfileRefresh();
  const { t, language } = useI18n();
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: profile.display_name,
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      username: profile.username,
      bio: profile.bio ?? "",
    },
  });
  const bio = useWatch({ control, name: "bio" });
  const next = profile.username_changed_at
    ? new Date(new Date(profile.username_changed_at).getTime() + 30 * 86400000)
    : null;
  const locked = !!next && next.getTime() > Date.now();
  const submit = handleSubmit(async (values) => {
    setNotice("");
    try {
      if (values.username !== profile.username) {
        const r = await supabase
          .from("profiles_visible")
          .select("id")
          .eq("username", values.username)
          .neq("id", profile.id)
          .limit(1);
        if (r.error) throw r.error;
        if (r.data.length) {
          setError("username", { message: "This username is taken" });
          return;
        }
      }
      const r = await supabase
        .from("profiles")
        .update(values)
        .eq("id", profile.id)
        .select("id")
        .single();
      if (r.error?.code === "23505") {
        setError("username", { message: "Someone just took this username. Try another." });
        return;
      }
      if (r.error) throw r.error;
      reset(values);
      await refresh();
      setNotice("Profile updated");
    } catch (error) {
      setError("root", {
        message:
          error && typeof error === "object" && "message" in error
            ? String(error.message)
            : "Something went wrong. Please try again.",
      });
    }
  });
  return {
    notice,
    setNotice,
    t,
    language,
    register,
    errors,
    isDirty,
    isSubmitting,
    bio,
    ...(locked && next ? { locked: true as const, next } : { locked: false as const, next }),
    submit,
  };
}
