import { Link2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsPage } from "@/features/settings/components/presentation";
import { QueryState } from "@/features/settings/components/shared";
import { type Profile, useProfile } from "@/features/settings/hooks";
import { useSocialLinksForm } from "@/features/settings/hooks/useSocialLinksForm";
import { FIXED_PLATFORMS, MAX_CUSTOM_LINKS, MAX_FIELD_LENGTH } from "@/lib/social-links";
export function SocialLinksPage() {
  const profile = useProfile();
  return (
    <SettingsPage title="Social links">
      <QueryState
        loading={profile.isLoading}
        error={profile.error}
        retry={() => void profile.refetch()}
      />
      {profile.data && <SocialForm profile={profile.data} />}
    </SettingsPage>
  );
}
function SocialForm({ profile }: { profile: Profile }) {
  const { links, setLinks, keys, setKeys, action, t, custom, submit } = useSocialLinksForm(profile);
  return (
    <form className="settings-form settings-card settings-card-body" onSubmit={submit}>
      <fieldset disabled={action.busy}>
        {FIXED_PLATFORMS.map((platform) => (
          <div key={platform.key}>
            <label htmlFor={platform.key}>
              <Link2 size={16} aria-hidden="true" /> {platform.label}
            </label>
            <input
              id={platform.key}
              type="text"
              maxLength={MAX_FIELD_LENGTH}
              placeholder={platform.placeholder}
              value={links[platform.key] ?? ""}
              onChange={(e) => setLinks({ ...links, [platform.key]: e.target.value })}
            />
          </div>
        ))}
        <h2>
          {t("Custom links")}{" "}
          <small>
            {custom.length}/{MAX_CUSTOM_LINKS}
          </small>
        </h2>
        {custom.map((link, index) => (
          <div className="custom-link-row" key={keys[index]}>
            <label>
              {t("Label")}
              <input
                maxLength={MAX_FIELD_LENGTH}
                value={link.label}
                onChange={(e) =>
                  setLinks({
                    ...links,
                    custom: custom.map((v, i) =>
                      i === index ? { ...v, label: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
            <label>
              {t("URL or text")}
              <input
                type="text"
                maxLength={MAX_FIELD_LENGTH}
                value={link.url}
                onChange={(e) =>
                  setLinks({
                    ...links,
                    custom: custom.map((v, i) => (i === index ? { ...v, url: e.target.value } : v)),
                  })
                }
              />
            </label>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={`${t("Remove link")} ${index + 1}`}
              onClick={() => {
                setLinks({ ...links, custom: custom.filter((_, i) => i !== index) });
                setKeys(keys.filter((_, i) => i !== index));
              }}
            >
              <Trash2 size={18} />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          type="button"
          disabled={custom.length >= MAX_CUSTOM_LINKS}
          onClick={() => {
            setLinks({ ...links, custom: [...custom, { label: "", url: "" }] });
            setKeys([...keys, crypto.randomUUID()]);
          }}
        >
          + {t("Add custom link")}
        </Button>
        {action.feedback}
        <Button type="submit">{t(action.busy ? "Saving…" : "Save links")}</Button>
      </fieldset>
    </form>
  );
}
