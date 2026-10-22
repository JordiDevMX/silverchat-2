import { Link2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { QueryState, SettingsPage, useAction } from "@/features/settings/components/shared";
import { type Profile, useProfile, useProfileRefresh } from "@/features/settings/hooks";
import {
  FIXED_PLATFORMS,
  MAX_CUSTOM_LINKS,
  MAX_FIELD_LENGTH,
  normalizeSocialLinks,
} from "@/lib/social-links";
import { supabase } from "@/lib/supabase";
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
  const [links, setLinks] = useState(() => normalizeSocialLinks(profile.social_links));
  const [keys, setKeys] = useState(() => links.custom?.map(() => crypto.randomUUID()) ?? []);
  const action = useAction();
  const refresh = useProfileRefresh();
  const { t } = useI18n();
  const custom = links.custom ?? [];
  return (
    <form
      className="settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        void action.run(async () => {
          const normalized = normalizeSocialLinks(links);
          const r = await supabase
            .from("profiles")
            .update({ social_links: { ...normalized } })
            .eq("id", profile.id)
            .select("id")
            .single();
          if (r.error) throw r.error;
          setLinks(normalized);
          setKeys(normalized.custom?.map(() => crypto.randomUUID()) ?? []);
          await refresh();
        }, "Saved");
      }}
    >
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
            <button
              className="icon-button"
              type="button"
              aria-label={`${t("Remove link")} ${index + 1}`}
              onClick={() => {
                setLinks({ ...links, custom: custom.filter((_, i) => i !== index) });
                setKeys(keys.filter((_, i) => i !== index));
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        <button
          className="button secondary"
          type="button"
          disabled={custom.length >= MAX_CUSTOM_LINKS}
          onClick={() => {
            setLinks({ ...links, custom: [...custom, { label: "", url: "" }] });
            setKeys([...keys, crypto.randomUUID()]);
          }}
        >
          + {t("Add custom link")}
        </button>
        {action.feedback}
        <button className="button primary" type="submit">
          {t(action.busy ? "Saving…" : "Save links")}
        </button>
      </fieldset>
    </form>
  );
}
