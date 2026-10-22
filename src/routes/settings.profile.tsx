import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useI18n } from "@/app/providers/i18n-provider";
import { InlineError } from "@/features/auth/components";
import { AvatarPickerModal } from "@/features/settings/components/AvatarPickerModal";
import {
  Avatar,
  QueryState,
  SettingRow,
  SettingsPage,
} from "@/features/settings/components/shared";
import { type Profile, useProfile, useProfileRefresh } from "@/features/settings/hooks";
import { supabase } from "@/lib/supabase";

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
export function EditProfilePage() {
  const profile = useProfile();
  return (
    <SettingsPage title="Edit profile">
      <QueryState
        loading={profile.isLoading}
        error={profile.error}
        retry={() => void profile.refetch()}
      />
      {profile.data && <ProfileForm key={profile.data.id} profile={profile.data} />}
    </SettingsPage>
  );
}
function ProfileForm({ profile }: { profile: Profile }) {
  const [picker, setPicker] = useState(false);
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
  return (
    <>
      <div className="profile-avatar-editor">
        <button type="button" aria-label={t("Change photo")} onClick={() => setPicker(true)}>
          <Avatar profile={profile} size="large" />
          <span>{t("Change photo")}</span>
        </button>
      </div>
      <form className="settings-form" onSubmit={submit} noValidate>
        <fieldset disabled={isSubmitting}>
          <label htmlFor="display-name">{t("Display name")}</label>
          <input
            id="display-name"
            maxLength={50}
            autoComplete="nickname"
            {...register("display_name")}
          />
          <InlineError>{errors.display_name?.message}</InlineError>
          <div className="form-columns">
            {(["first_name", "last_name"] as const).map((field) => (
              <div key={field}>
                <label htmlFor={field}>
                  {t(field === "first_name" ? "First name" : "Last name")}
                </label>
                <input
                  id={field}
                  maxLength={50}
                  autoComplete={field === "first_name" ? "given-name" : "family-name"}
                  {...register(field)}
                />
                <InlineError>{errors[field]?.message}</InlineError>
              </div>
            ))}
          </div>
          <label htmlFor="profile-username">{t("Username")}</label>
          <div className="input-with-icon">
            <span>@</span>
            <input
              id="profile-username"
              maxLength={20}
              autoCapitalize="none"
              autoComplete="username"
              readOnly={locked}
              aria-disabled={locked}
              {...register("username")}
            />
          </div>
          {locked && (
            <p className="quiet-note">
              {language === "es"
                ? "Puedes cambiar tu nombre de usuario el"
                : "You can change your username again on"}{" "}
              {next.toLocaleDateString(language)}.
            </p>
          )}
          <InlineError>{errors.username?.message}</InlineError>
          <label htmlFor="bio">{t("Bio")}</label>
          <textarea id="bio" rows={4} maxLength={160} {...register("bio")} />
          <small className="field-counter">{bio.length}/160</small>
          <InlineError>{errors.bio?.message}</InlineError>
          <SettingRow href="/settings/profile/social" label="Social links" />
          <InlineError>{errors.root?.message}</InlineError>
          <button className="button primary" disabled={!isDirty || isSubmitting} type="submit">
            {t(isSubmitting ? "Saving…" : "Save profile")}
          </button>
        </fieldset>
      </form>
      {notice && (
        <p role="status" className="settings-notice">
          {t(notice)}
        </p>
      )}
      {picker && (
        <AvatarPickerModal
          profile={profile}
          onClose={() => setPicker(false)}
          onSaved={(warning) =>
            setNotice(
              warning
                ? "Profile photo updated. The previous file could not be removed; cleanup is pending."
                : "Profile photo updated",
            )
          }
        />
      )}
    </>
  );
}
