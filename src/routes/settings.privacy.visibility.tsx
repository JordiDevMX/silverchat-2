import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { ManageExclusionsModal } from "@/features/settings/components/ManageExclusionsModal";
import { QueryState, SettingsPage, Toggle, useAction } from "@/features/settings/components/shared";
import { usePreferences } from "@/features/settings/preferences-provider";

const options = [
  ["everyone", "Everyone"],
  ["contacts", "My contacts"],
  ["contacts_except", "My contacts except…"],
  ["nobody", "Nobody"],
] as const;
export function VisibilityPage() {
  const { settings, loading, save } = usePreferences();
  const [exclusions, setExclusions] = useState<
    "profile_photo_exclusions" | "story_exclusions" | null
  >(null);
  const action = useAction();
  const { t } = useI18n();
  return (
    <SettingsPage title="Privacy">
      <QueryState loading={loading} error={null} />
      {settings && (
        <>
          {(
            [
              {
                anchor: "photo",
                label: "Profile photo",
                field: "profile_photo_visibility",
                excluded: "profile_photo_exclusions",
              },
              {
                anchor: "stories",
                label: "Stories",
                field: "story_visibility",
                excluded: "story_exclusions",
              },
            ] as const
          ).map((section) => (
            <section
              id={section.anchor}
              key={section.anchor}
              className="settings-card settings-card-body"
            >
              <fieldset disabled={action.busy}>
                <legend>{t(section.label)}</legend>
                {options.map(([value, label]) => (
                  <label className="radio-row" key={value}>
                    <input
                      type="radio"
                      name={section.field}
                      checked={settings[section.field] === value}
                      onChange={() => void action.run(() => save({ [section.field]: value }))}
                    />
                    <span>{t(label)}</span>
                  </label>
                ))}
                {settings[section.field] === "contacts_except" && (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setExclusions(section.excluded)}
                  >
                    {t("Manage exclusions")} ({settings[section.excluded].length})
                  </button>
                )}
              </fieldset>
            </section>
          ))}
          <section id="presence" className="settings-card settings-card-body">
            <Toggle
              label="Show when I’m online and last seen"
              checked={settings.presence_visible}
              disabled={action.busy}
              onChange={(value) => void action.run(() => save({ presence_visible: value }))}
            />
          </section>
        </>
      )}
      {action.feedback}
      {exclusions && (
        <ManageExclusionsModal field={exclusions} onClose={() => setExclusions(null)} />
      )}
    </SettingsPage>
  );
}
