import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/features/auth/components";
import { AvatarPickerModal } from "@/features/settings/components/AvatarPickerModal";
import { SettingsPage } from "@/features/settings/components/presentation";
import { Avatar, QueryState, SettingRow } from "@/features/settings/components/shared";
import { type Profile, useProfile } from "@/features/settings/hooks";
import { useProfileForm } from "@/features/settings/hooks/useProfileForm";

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
  const {
    notice,
    setNotice,
    t,
    language,
    register,
    errors,
    isDirty,
    isSubmitting,
    bio,
    next,
    locked,
    submit,
  } = useProfileForm(profile);
  return (
    <>
      <div className="profile-avatar-editor">
        <Button
          variant="ghost"
          className="profile-photo-trigger"
          type="button"
          aria-label={t("Change photo")}
          onClick={() => setPicker(true)}
        >
          <Avatar profile={profile} size="large" />
          <span>{t("Change photo")}</span>
        </Button>
      </div>
      <form className="settings-form settings-card settings-card-body" onSubmit={submit} noValidate>
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
          <Button disabled={!isDirty || isSubmitting} type="submit">
            {t(isSubmitting ? "Saving…" : "Save profile")}
          </Button>
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
