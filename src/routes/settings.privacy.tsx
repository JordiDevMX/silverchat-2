import { useState } from "react";
import { DisableReadReceiptsModal } from "@/features/settings/components/DisableReadReceiptsModal";
import {
  QueryState,
  SettingRow,
  SettingsPage,
  Toggle,
  useAction,
} from "@/features/settings/components/shared";
import { usePreferences } from "@/features/settings/preferences-provider";
export function PrivacyPage() {
  const preferences = usePreferences();
  const [warning, setWarning] = useState(false);
  const action = useAction();
  return (
    <SettingsPage title="Privacy">
      <div className="settings-card">
        <SettingRow href="/settings/privacy/blocked" label="Blocked contacts" />
        <SettingRow href="/settings/privacy/visibility#photo" label="Profile photo" />
        <SettingRow href="/settings/privacy/visibility#presence" label="Last seen & online" />
        <SettingRow href="/settings/privacy/visibility#stories" label="Stories" />
      </div>
      <QueryState loading={preferences.loading} error={null} />
      {preferences.settings && (
        <div className="settings-card settings-card-body">
          <Toggle
            label="Send read receipts"
            description="When on, others can see when you’ve read their messages. When off, you won’t see their read receipts either."
            checked={preferences.settings.read_receipts_enabled}
            disabled={action.busy}
            onChange={(enabled) => {
              if (!enabled) setWarning(true);
              else void action.run(() => preferences.save({ read_receipts_enabled: true }));
            }}
          />
        </div>
      )}
      {action.feedback}
      {warning && <DisableReadReceiptsModal onClose={() => setWarning(false)} />}
    </SettingsPage>
  );
}
